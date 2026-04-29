"""
harlan_ai.suppliers._base.anomaly

Детектор аномалий. Накапливает offer-ы по группам (subcategory, mark, unit)
и помечает выбросы. Используется loader-ом ПОСЛЕ полного парсинга файла —
парсер сначала собирает все строки, затем прогоняет через детектор.

КРИТЕРИИ АНОМАЛИЙ (см. Закон 2 в архитектурном решении 2026-04-27):
  * цена в группе одинаковых ключей отличается от медианы > 25%
  * новая подкатегория не из known_subcategories
  * новый заголовок столбцов не из known_headers
  * единица измерения не из known_units
  * цена < 1 ₽ или > 10 000 000 ₽
  * дубликаты с разной ценой
  * марка содержит подозрительные паттерны
"""

from __future__ import annotations
from collections import defaultdict
from statistics import median
from typing import Iterable

from .types import AnomalyKind, ParsedOffer


# Конфиг по умолчанию. Может переопределяться через supplier_parsing_rules.
DEFAULT_PRICE_JUMP_THRESHOLD = 0.25       # 25%
DEFAULT_MIN_PRICE = 1.0
DEFAULT_MAX_PRICE = 10_000_000.0


class AnomalyDetector:
    """
    Применяется к списку ParsedOffer. Возвращает изменённый список
    (с проставленными has_anomaly, anomaly_reason) и список вопросов
    которые нужно задать менеджеру.
    """

    def __init__(
        self,
        known_subcategories: Iterable[str] = (),
        known_units: Iterable[str] = (),
        price_jump_threshold: float = DEFAULT_PRICE_JUMP_THRESHOLD,
        min_price: float = DEFAULT_MIN_PRICE,
        max_price: float = DEFAULT_MAX_PRICE,
    ):
        self.known_subcategories = {s.upper() for s in known_subcategories}
        self.known_units = set(known_units)
        self.price_jump_threshold = price_jump_threshold
        self.min_price = min_price
        self.max_price = max_price

    def detect(self, offers: list[ParsedOffer]) -> list[ParsedOffer]:
        """In-place простановка has_anomaly + anomaly_reason."""
        # Группа = (subcategory, mark, unit). Внутри группы ищем выбросы по цене.
        groups: dict[tuple, list[ParsedOffer]] = defaultdict(list)
        for o in offers:
            key = (
                (o.subcategory or "").strip().upper(),
                (o.mark or "").strip(),
                (o.unit or "").strip(),
                (o.dimension_raw or "").strip(),
            )
            groups[key].append(o)

        for o in offers:
            reasons = []

            # 1) выходит за разумные пределы цены
            if o.supplier_price is None:
                reasons.append("invalid_price:none")
            elif o.supplier_price < self.min_price:
                reasons.append(f"invalid_price:below_min({o.supplier_price})")
            elif o.supplier_price > self.max_price:
                reasons.append(f"invalid_price:above_max({o.supplier_price})")

            # 2) неизвестная подкатегория
            if o.subcategory and self.known_subcategories:
                if o.subcategory.strip().upper() not in self.known_subcategories:
                    reasons.append(f"unknown_subcategory:{o.subcategory}")

            # 3) неизвестная единица измерения
            if o.unit and self.known_units:
                if o.unit.strip() not in self.known_units:
                    reasons.append(f"unknown_unit:{o.unit}")

            # 4) пустые ключевые поля
            if not o.mark and not o.dimension_raw:
                reasons.append("empty_key")

            if reasons:
                o.has_anomaly = True
                o.anomaly_reason = ";".join(reasons)

        # 5) выбросы цены внутри одной группы
        for key, group in groups.items():
            prices = [g.supplier_price for g in group if g.supplier_price]
            if len(prices) < 3:
                continue                       # не хватает данных для статистики
            med = median(prices)
            if med <= 0:
                continue
            for g in group:
                if g.supplier_price is None:
                    continue
                deviation = abs(g.supplier_price - med) / med
                if deviation > self.price_jump_threshold:
                    extra = f"price_jump:{deviation:.0%}_from_median_{med:.0f}"
                    g.has_anomaly = True
                    g.anomaly_reason = (
                        f"{g.anomaly_reason};{extra}" if g.anomaly_reason else extra
                    )

        # 6) дубликаты с разной ценой → отдельная пометка
        for key, group in groups.items():
            unique_prices = {g.supplier_price for g in group if g.supplier_price}
            if len(unique_prices) > 1:
                for g in group:
                    extra = "duplicate_diff_price"
                    if g.anomaly_reason and extra not in g.anomaly_reason:
                        g.anomaly_reason = f"{g.anomaly_reason};{extra}"
                        g.has_anomaly = True
                    elif not g.anomaly_reason:
                        g.anomaly_reason = extra
                        g.has_anomaly = True

        return offers

    def summarize(self, offers: list[ParsedOffer]) -> dict:
        """Сводка для CLI/логов."""
        total = len(offers)
        with_anomaly = sum(1 for o in offers if o.has_anomaly)
        by_reason: dict[str, int] = defaultdict(int)
        for o in offers:
            if not o.anomaly_reason:
                continue
            for r in o.anomaly_reason.split(";"):
                first_word = r.split(":")[0]
                by_reason[first_word] += 1
        return {
            "total": total,
            "with_anomaly": with_anomaly,
            "anomaly_share": round(with_anomaly / total * 100, 1) if total else 0,
            "by_reason": dict(by_reason),
        }

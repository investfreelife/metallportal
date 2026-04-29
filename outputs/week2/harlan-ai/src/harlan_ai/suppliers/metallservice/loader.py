"""
harlan_ai.suppliers.metallservice.loader

Парсер прайс-листов поставщика "Металлсервис" (mc.ru).
Формат: газетный 2-колоночный .xls (BIFF8), по 9 колонок на лист:
  cols 0..3  = левая половина  [Марка | Диаметр | Ед.изм | Цена]
  col  4     = разделитель
  cols 5..8  = правая половина (тот же набор)

Иерархия в прайсе:
  Раздел (section)         — например "Сортовой прокат" — обычно один на файл
    Подкатегория (subcat)  — "АРМАТУРА", "УГОЛОК", "УГОЛОК НИЗКОЛЕГИР"
      Заголовки колонок    — "Марка | диаметр | Ед.изм | Цена"
        Строки данных      — реальные позиции

Loader НЕ интерпретирует данные. Он:
  1. читает .xls построчно
  2. распознаёт типы строк (заголовок раздела / подкатегория / заголовок колонок / данные / мусор)
  3. наследует контекст (section → subcat) на следующие строки
  4. для каждой ячейки данных создаёт SourceRef
  5. собирает ParsedOffer-ы
  6. прогоняет через AnomalyDetector
  7. через StagingWriter пишет в БД
  8. через questions_from_anomalies формирует вопросы менеджеру

Зависимости:
  - xlrd (для чтения .xls)
  - pyyaml (для чтения config.yaml)
"""

from __future__ import annotations
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Iterable
from uuid import UUID

import yaml

try:
    import xlrd  # type: ignore
except ImportError:
    xlrd = None  # будем падать с понятной ошибкой при попытке читать

from .._base.types import (
    ParsedOffer,
    SourceRef,
    UploadContext,
    AnomalyKind,
)
from .._base.source_ref import make_source_ref, col_letter
from .._base.anomaly import AnomalyDetector
from .._base.staging import StagingWriter, questions_from_anomalies

log = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.yaml"


# ─── Утилиты ──────────────────────────────────────────────────────────────
def _norm_str(v) -> str:
    """xlrd cell value → нормализованная строка."""
    if v is None:
        return ""
    s = str(v)
    # xlrd возвращает float для чисел: "12.0" → "12"
    if isinstance(v, float) and v == int(v):
        s = str(int(v))
    return s.strip()


def _parse_price(v) -> Optional[float]:
    """Парсит цену. Поддерживает русский формат "3369,82"."""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v) if v > 0 else None
    s = str(v).strip().replace(" ", "").replace("\u00A0", "").replace(",", ".")
    if not s:
        return None
    try:
        f = float(s)
        return f if f > 0 else None
    except ValueError:
        return None


# ─── Базовые типы строк ───────────────────────────────────────────────────
HALF_LEFT = (0, 1, 2, 3)
HALF_RIGHT = (5, 6, 7, 8)
SEP_COL = 4


@dataclass
class HalfRow:
    """Половина строки: 4 ячейки (mark / dim / unit / price)."""
    mark: str
    dim: str
    unit: str
    price_raw: str
    cols: tuple[int, int, int, int]      # индексы исходных колонок (0-based)

    def is_empty(self) -> bool:
        return not any((self.mark, self.dim, self.unit, self.price_raw))

    def is_header(self, header_keywords: set[str]) -> bool:
        cells = [self.mark, self.dim, self.unit, self.price_raw]
        nz = [c.lower() for c in cells if c]
        if not nz:
            return False
        # хотя бы 2 ячейки матчатся ключевыми словами + есть "цена"
        matches = sum(1 for c in nz if any(kw in c for kw in header_keywords))
        has_price_word = any("цена" in c for c in nz)
        return matches >= 2 and has_price_word


# ─── Loader ───────────────────────────────────────────────────────────────
class MetallserviceLoader:
    """
    Использование:

        loader = MetallserviceLoader(supabase_client, ctx)
        result = loader.run()                # парсит файл, пишет в БД
        print(result.summary())
    """

    def __init__(self, sb_client, ctx: UploadContext, dry_run: bool = False):
        self.sb = sb_client
        self.ctx = ctx
        self.dry_run = dry_run
        self.config = self._load_config()
        self.staging = StagingWriter(sb_client, ctx, dry_run=dry_run)
        self.detector = AnomalyDetector(
            known_subcategories=self.config.get("known_subcategories", []),
            known_units=self.config.get("known_units", []),
        )

    def _load_config(self) -> dict:
        if not CONFIG_PATH.exists():
            log.warning("config.yaml not found at %s, using defaults", CONFIG_PATH)
            return {}
        return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}

    # ─── публичный entrypoint ─────────────────────────────────────────
    def run(self) -> "LoaderResult":
        if xlrd is None:
            raise RuntimeError(
                "xlrd not installed. `pip install xlrd<2.0` (поддерживает .xls BIFF)."
            )
        offers = self._parse_file()
        log.info("[%s] parsed %d offers", self.ctx.file_name, len(offers))

        # Аномалии
        offers = self.detector.detect(offers)
        anomaly_summary = self.detector.summarize(offers)
        log.info("[%s] anomalies: %s", self.ctx.file_name, anomaly_summary)

        # Запись в БД
        offer_ids = self.staging.write_offers(offers)

        # Вопросы менеджеру
        questions = questions_from_anomalies(offers, offer_ids)
        for q in questions:
            self.staging.write_question(q)
        log.info("[%s] created %d parsing_questions", self.ctx.file_name, len(questions))

        # Финализация
        self.staging.finalize()

        return LoaderResult(
            file_name=self.ctx.file_name,
            offers_parsed=len(offers),
            offers_with_anomaly=anomaly_summary["with_anomaly"],
            questions_created=len(questions),
            anomaly_summary=anomaly_summary,
        )

    # ─── собственно парсинг ──────────────────────────────────────────
    def _parse_file(self) -> list[ParsedOffer]:
        book = xlrd.open_workbook(self.ctx.file_path)
        offers: list[ParsedOffer] = []
        for sheet_idx in range(book.nsheets):
            sheet = book.sheet_by_index(sheet_idx)
            offers.extend(self._parse_sheet(sheet))
        return offers

    def _parse_sheet(self, sheet) -> list[ParsedOffer]:
        # дефолтный раздел из имени файла
        category_hint = (self.ctx.category_hint or "").lower()
        section_default = self.config.get("file_to_section", {}).get(
            category_hint, category_hint or "Без раздела"
        )

        header_keywords = set(self.config.get("header_keywords", []))
        ignore_re = [re.compile(p, re.I) for p in self.config.get("ignore_patterns", [])]

        # state machine
        current_section: Optional[str] = section_default
        current_subcat_left: Optional[str] = None
        current_subcat_right: Optional[str] = None
        # последние увиденные заголовки колонок (могут различаться для левой и правой половины)
        # дефолт: марка/диаметр/ед.изм/цена
        # хранится только для документации — в данный момент не используется в логике (имя поля = "mark/dim/unit/price")
        # потому что наш ParsedOffer — фиксированный.

        offers: list[ParsedOffer] = []

        for row_idx in range(sheet.nrows):
            row_cells = [_norm_str(sheet.cell_value(row_idx, c)) if c < sheet.ncols else ""
                         for c in range(9)]
            # пропуск мусорных строк
            joined = " ".join(c for c in row_cells if c).strip()
            if not joined:
                continue
            if any(p.search(joined) for p in ignore_re):
                continue

            # делим на левую и правую половины
            left = HalfRow(
                mark=row_cells[0], dim=row_cells[1],
                unit=row_cells[2], price_raw=row_cells[3],
                cols=HALF_LEFT,
            )
            right = HalfRow(
                mark=row_cells[5] if len(row_cells) > 5 else "",
                dim=row_cells[6] if len(row_cells) > 6 else "",
                unit=row_cells[7] if len(row_cells) > 7 else "",
                price_raw=row_cells[8] if len(row_cells) > 8 else "",
                cols=HALF_RIGHT,
            )

            # 1) проверка: это ЗАГОЛОВОК раздела (одна большая ячейка "Сортовой прокат")?
            #    — обычно это row[0..0], остальные пустые, и текст похож на known section
            if (left.mark and not left.dim and not left.unit and not left.price_raw
                    and right.is_empty()):
                # это либо section, либо subcategory
                value = left.mark
                upper = value.upper()
                if upper in {s.upper() for s in self.config.get("known_subcategories", [])}:
                    current_subcat_left = value
                    current_subcat_right = value     # обычно подкат охватывает обе половины пока не сменится
                else:
                    # heuristic: длинная строка с большой буквы → секция
                    # короткая ВСЕ КАПС → подкатегория
                    if value.isupper() or len(value.split()) <= 4:
                        current_subcat_left = value
                        current_subcat_right = value
                    else:
                        current_section = value
                continue

            # 2) проверка: это ЗАГОЛОВОК столбцов?
            if left.is_header(header_keywords) and right.is_header(header_keywords):
                # заголовок и слева и справа — пропускаем
                continue
            if left.is_header(header_keywords):
                # слева заголовок, справа может быть строка с подкатегорией справа
                if right.mark and not right.dim and not right.unit and not right.price_raw:
                    current_subcat_right = right.mark
                continue
            if right.is_header(header_keywords):
                if left.mark and not left.dim and not left.unit and not left.price_raw:
                    current_subcat_left = left.mark
                continue

            # 3) Это строка ДАННЫХ. Каждая половина независимо.
            for half, current_subcat in ((left, current_subcat_left),
                                          (right, current_subcat_right)):
                if half.is_empty():
                    continue

                # подкатегория-в-середине-половины (текст занимает только первую ячейку, цены нет)
                if half.mark and not half.unit and not half.price_raw and not half.dim:
                    if half is left:
                        current_subcat_left = half.mark
                    else:
                        current_subcat_right = half.mark
                    continue

                price = _parse_price(half.price_raw)
                if price is None and not half.mark and not half.dim:
                    # пустая половина в этой строке
                    continue

                src = make_source_ref(
                    file=self.ctx.file_name,
                    sheet=sheet.name,
                    row_zero_based=row_idx,
                    col_zero_based=half.cols[3],   # колонка цены — анкер для трассировки
                )

                offers.append(ParsedOffer(
                    section=current_section,
                    subcategory=current_subcat if half is left else current_subcat_right,
                    mark=half.mark or None,
                    dimension_raw=half.dim or None,
                    unit=half.unit or None,
                    supplier_price=price,
                    source_ref=src,
                    raw_row=row_cells,
                ))
        return offers


# ─── Результат ────────────────────────────────────────────────────────────
@dataclass
class LoaderResult:
    file_name: str
    offers_parsed: int
    offers_with_anomaly: int
    questions_created: int
    anomaly_summary: dict

    def summary(self) -> str:
        return (
            f"{self.file_name}: parsed={self.offers_parsed}, "
            f"anomalies={self.offers_with_anomaly} "
            f"({self.anomaly_summary.get('anomaly_share', 0)}%), "
            f"questions={self.questions_created}"
        )

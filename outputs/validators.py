"""
harlan-ai/src/harlan_ai/validators.py

ВАЛИДАЦИОННЫЙ ШЛЮЗ. Ни одно КП и ни один ответ AI с ценами не уходит клиенту,
пока цены не сверены с актуальными price_items в Supabase.

Принципы:
  - расхождение > tolerance → блокировка
  - SKU не найден в БД → блокировка
  - цена 0 / None / отрицательная → блокировка
  - все блокировки логируются в data_quality_queue (issue_type=*_at_kp)

Использование в tasks.py:

    from .validators import validate_pricing

    def generate_kp(name, company, request, contact_id):
        items = _llm_generate_items(...)
        result = validate_pricing(items, contact_id=contact_id)
        if not result.ok:
            _enqueue_for_manual_review(items, result, contact_id)
            return {"blocked": True, "reason": result.error, "failed": result.failed_items}
        return _format_kp(items)

Или через декоратор:

    @with_validation
    def search_metal(query, context=None) -> dict:
        ...
"""

from __future__ import annotations
import logging
import os
from dataclasses import dataclass, field
from typing import Optional, Callable, Any

from supabase import create_client, Client

log = logging.getLogger(__name__)

# ─── Конфиг ────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
TENANT_ID = os.environ.get("TENANT_ID", "a1000000-0000-0000-0000-000000000001")

DEFAULT_TOLERANCE = 0.05  # 5%

_supabase: Optional[Client] = None


def _sb() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase


# ─── Результат валидации ───────────────────────────────────────────────────
@dataclass
class ValidationResult:
    ok: bool
    error: Optional[str] = None
    failed_items: list[dict] = field(default_factory=list)
    checked_count: int = 0

    def __bool__(self) -> bool:
        return self.ok


# ─── Поиск актуальной цены по SKU ──────────────────────────────────────────
def _fetch_current_price(sku: str) -> Optional[float]:
    """
    Минимальная актуальная цена среди in_stock=true price_items.
    Ищет product сначала по article, потом по slug.
    Возвращает None если SKU не найден или нет активных цен.
    """
    if not sku:
        return None

    sb = _sb()

    # Поиск product
    prod = (
        sb.table("products")
        .select("id")
        .or_(f"article.eq.{sku},slug.eq.{sku}")
        .limit(1)
        .execute()
    )
    if not prod.data:
        return None

    product_id = prod.data[0]["id"]

    prices = (
        sb.table("price_items")
        .select("base_price, discount_price, in_stock")
        .eq("product_id", product_id)
        .eq("in_stock", True)
        .execute()
    )
    if not prices.data:
        return None

    valid: list[float] = []
    for row in prices.data:
        p = row.get("discount_price") or row.get("base_price")
        if p is not None and float(p) > 0:
            valid.append(float(p))

    return min(valid) if valid else None


# ─── Логирование проблемы в data_quality_queue ─────────────────────────────
def _log_dq_issue(issue_type: str, details: dict, severity: str = "critical") -> None:
    try:
        _sb().rpc(
            "upsert_dq_issue",
            {
                "p_tenant_id": TENANT_ID,
                "p_issue_type": issue_type,
                "p_product_id": None,
                "p_price_item_id": None,
                "p_severity": severity,
                "p_details": details,
            },
        ).execute()
    except Exception as e:
        log.warning("failed to log dq issue %s: %s", issue_type, e)


# ─── Главная функция: validate_pricing ─────────────────────────────────────
def validate_pricing(
    items: list[dict],
    tolerance: float = DEFAULT_TOLERANCE,
    contact_id: Optional[str] = None,
    log_to_dq_queue: bool = True,
) -> ValidationResult:
    """
    Сверка списка позиций с актуальными ценами в БД.

    items[i] должно содержать как минимум:
        - 'sku' или 'article'
        - 'price_per_unit' или 'price'
        - 'unit'
        - 'quantity'

    Returns:
        ValidationResult.ok=True если все позиции прошли
        ValidationResult.failed_items — список словарей с reason для каждой проблемы
    """
    failed: list[dict] = []

    for item in items:
        sku = item.get("sku") or item.get("article")
        observed = item.get("price_per_unit") or item.get("price")

        if not sku:
            failed.append({"item": item, "reason": "no_sku"})
            continue

        if observed is None or float(observed) <= 0:
            failed.append({"item": item, "reason": "zero_or_negative_price", "sku": sku})
            continue

        try:
            db_price = _fetch_current_price(sku)
        except Exception as e:
            log.error("price fetch failed for sku=%s: %s", sku, e)
            failed.append({"item": item, "reason": "db_error", "sku": sku})
            continue

        if db_price is None:
            failed.append({
                "item": item,
                "reason": "sku_not_found_or_no_active_price",
                "sku": sku,
            })
            if log_to_dq_queue:
                _log_dq_issue(
                    "missing_price_at_kp",
                    {"sku": sku, "ai_quoted": float(observed), "contact_id": contact_id},
                )
            continue

        deviation = abs(float(observed) - db_price) / db_price
        if deviation > tolerance:
            failed.append({
                "item": item,
                "reason": "price_deviation",
                "sku": sku,
                "ai_price": float(observed),
                "db_price": db_price,
                "deviation_pct": round(deviation * 100, 2),
            })
            if log_to_dq_queue:
                _log_dq_issue(
                    "price_mismatch_at_kp",
                    {
                        "sku": sku,
                        "ai_price": float(observed),
                        "db_price": db_price,
                        "deviation_pct": round(deviation * 100, 2),
                        "contact_id": contact_id,
                    },
                )

    if failed:
        log.warning(
            "validate_pricing FAILED %d/%d items contact=%s",
            len(failed), len(items), contact_id,
        )
        return ValidationResult(
            ok=False,
            error=f"{len(failed)} of {len(items)} items failed pricing validation",
            failed_items=failed,
            checked_count=len(items),
        )

    log.info("validate_pricing OK %d items contact=%s", len(items), contact_id)
    return ValidationResult(ok=True, checked_count=len(items))


# ─── Декоратор для tasks.py ────────────────────────────────────────────────
def with_validation(generator_fn: Callable[..., dict]) -> Callable[..., dict]:
    """
    Оборачивает функцию tasks.py возвращающую {items: [...]}.
    При неуспехе валидации добавляет флаги:
        result['validation_blocked'] = True
        result['validation_error']   = str
        result['failed_items']       = [...]
    КЛИЕНТУ ЭТО НЕ ОТПРАВЛЯЕТСЯ — вызывающий код должен проверить флаг.
    """

    def wrapper(*args: Any, **kwargs: Any) -> dict:
        result = generator_fn(*args, **kwargs)
        if not isinstance(result, dict) or "items" not in result:
            return result

        validation = validate_pricing(
            result["items"],
            contact_id=kwargs.get("contact_id"),
        )

        if not validation.ok:
            result["validation_blocked"] = True
            result["validation_error"] = validation.error
            result["failed_items"] = validation.failed_items

        return result

    wrapper.__name__ = generator_fn.__name__
    wrapper.__doc__ = generator_fn.__doc__
    return wrapper

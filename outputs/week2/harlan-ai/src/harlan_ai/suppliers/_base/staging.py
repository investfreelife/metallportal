"""
harlan_ai.suppliers._base.staging

Запись результатов парсинга в БД. Использует RPC из миграции
20260504_supplier_pricing_v2.sql:
  - upsert_supplier_offer
  - create_parsing_question
  - finalize_supplier_upload
"""

from __future__ import annotations
import logging
from collections import defaultdict
from typing import Optional
from uuid import UUID

from supabase import Client

from .types import ParsedOffer, ParsingQuestion, UploadContext, AnomalyKind

log = logging.getLogger(__name__)


class StagingWriter:
    """Запись offer-ов и вопросов в БД."""

    def __init__(self, sb: Client, ctx: UploadContext, dry_run: bool = False):
        self.sb = sb
        self.ctx = ctx
        self.dry_run = dry_run
        self.written_offers: list[UUID] = []
        self.written_questions: list[UUID] = []

    # ─── записать offers ───────────────────────────────────────────────
    def write_offers(self, offers: list[ParsedOffer]) -> list[Optional[UUID]]:
        """Возвращает список offer_id (None если dry_run)."""
        ids: list[Optional[UUID]] = []
        for o in offers:
            if self.dry_run:
                ids.append(None)
                continue
            try:
                resp = self.sb.rpc(
                    "upsert_supplier_offer",
                    {
                        "p_tenant_id":      str(self.ctx.tenant_id),
                        "p_upload_id":      str(self.ctx.upload_id),
                        "p_supplier_id":    str(self.ctx.supplier_id),
                        "p_section":        o.section,
                        "p_subcategory":    o.subcategory,
                        "p_mark":           o.mark,
                        "p_dimension_raw":  o.dimension_raw,
                        "p_unit":           o.unit,
                        "p_supplier_price": o.supplier_price,
                        "p_source_ref":     o.source_ref.to_dict(),
                        "p_raw_row":        o.raw_row,
                        "p_has_anomaly":    o.has_anomaly,
                        "p_anomaly_reason": o.anomaly_reason,
                    },
                ).execute()
                offer_id = UUID(resp.data) if resp.data else None
                ids.append(offer_id)
                if offer_id:
                    self.written_offers.append(offer_id)
            except Exception as e:
                log.error("upsert_supplier_offer failed for source=%s: %s",
                          o.source_ref.to_dict(), e)
                ids.append(None)
        return ids

    # ─── записать parsing_questions ───────────────────────────────────
    def write_question(self, q: ParsingQuestion) -> Optional[UUID]:
        if self.dry_run:
            return None
        try:
            resp = self.sb.rpc(
                "create_parsing_question",
                {
                    "p_tenant_id":         str(self.ctx.tenant_id),
                    "p_upload_id":         str(self.ctx.upload_id),
                    "p_supplier_id":       str(self.ctx.supplier_id),
                    "p_question_type":     q.question_type.value,
                    "p_question_text":     q.question_text,
                    "p_context_rows":      q.context_rows,
                    "p_affected_offers":   [str(x) for x in q.affected_offer_ids],
                    "p_suggested_answers": q.suggested_answers,
                },
            ).execute()
            qid = UUID(resp.data) if resp.data else None
            if qid:
                self.written_questions.append(qid)
            return qid
        except Exception as e:
            log.error("create_parsing_question failed: %s (%s)", e, q.question_text)
            return None

    # ─── финализировать загрузку ───────────────────────────────────────
    def finalize(self) -> None:
        if self.dry_run:
            log.info("DRY-RUN: skipping finalize_supplier_upload")
            return
        try:
            self.sb.rpc(
                "finalize_supplier_upload",
                {"p_upload_id": str(self.ctx.upload_id)},
            ).execute()
        except Exception as e:
            log.error("finalize_supplier_upload failed: %s", e)


# ─── ХЕЛПЕР: вопросы из аномалий ──────────────────────────────────────
def questions_from_anomalies(
    offers: list[ParsedOffer],
    offer_ids: list[Optional[UUID]],
) -> list[ParsingQuestion]:
    """
    Группирует аномальные offer-ы в вопросы.
    Один вопрос = один тип аномалии + одна группа (subcategory|mark|unit).
    Менеджер отвечает один раз на группу, не на каждый offer.
    """
    by_kind_and_group: dict[tuple[str, str], list[tuple[ParsedOffer, Optional[UUID]]]] = defaultdict(list)

    for offer, oid in zip(offers, offer_ids):
        if not offer.has_anomaly or not offer.anomaly_reason:
            continue
        # Берём первый (главный) reason
        primary_reason = offer.anomaly_reason.split(";")[0].split(":")[0]
        group_key = f"{offer.subcategory or '-'}|{offer.mark or '-'}|{offer.unit or '-'}"
        by_kind_and_group[(primary_reason, group_key)].append((offer, oid))

    questions: list[ParsingQuestion] = []
    for (kind, group_key), pairs in by_kind_and_group.items():
        sample_offer = pairs[0][0]
        offer_ids_in_q = [oid for _, oid in pairs if oid]

        # подбираем тип вопроса
        if kind == "unknown_subcategory":
            qtype = AnomalyKind.UNKNOWN_SUBCATEGORY
            text = (
                f"В прайсе появилась подкатегория «{sample_offer.subcategory}» "
                f"которой нет в правилах для этого поставщика. "
                f"Что это? (например: УГОЛОК НИЗКОЛЕГИР = уголок из стали 09Г2С)"
            )
            suggested = {
                "options": [
                    {"key": "save_as_known", "label": "Запомнить как известную, импортировать как есть"},
                    {"key": "ignore",        "label": "Игнорировать эту подкатегорию"},
                    {"key": "split",         "label": "Это разные товары — нужен отдельный маппинг"},
                ]
            }

        elif kind == "unknown_unit":
            qtype = AnomalyKind.UNKNOWN_UNIT
            text = f"Единица измерения «{sample_offer.unit}» не из справочника. Что это?"
            suggested = {
                "options": [
                    {"key": "alias_t",      "label": "= 'т' (тонна)"},
                    {"key": "alias_teor_t", "label": "= 'теор.т' (теоретическая тонна)"},
                    {"key": "alias_m",      "label": "= 'м' (метр)"},
                    {"key": "save_as_new",  "label": "Это новая ед.изм., запомнить"},
                ]
            }

        elif kind == "price_jump":
            qtype = AnomalyKind.PRICE_ANOMALY
            text = (
                f"В группе «{sample_offer.subcategory or ''} / "
                f"{sample_offer.mark or ''} / {sample_offer.unit or ''}» "
                f"цена сильно отличается от медианы группы. Это нормально?"
            )
            suggested = {
                "options": [
                    {"key": "ok_keep_all",   "label": "Нормально — это разные склады/партии"},
                    {"key": "use_min",       "label": "Брать минимум как канон"},
                    {"key": "use_median",    "label": "Брать медиану как канон"},
                    {"key": "investigate",   "label": "Подозрительно — поставлю в очередь к админу"},
                ]
            }

        elif kind == "duplicate_diff_price":
            qtype = AnomalyKind.DUPLICATE_DIFFERENT_PRICE
            text = (
                f"Найден дубликат с разной ценой: "
                f"«{sample_offer.subcategory or ''} / {sample_offer.mark or ''} / "
                f"{sample_offer.dimension_raw or ''} / {sample_offer.unit or ''}». "
                f"Что брать?"
            )
            suggested = {
                "options": [
                    {"key": "use_min",     "label": "Минимальную (самая дешёвая офферта)"},
                    {"key": "use_median",  "label": "Медиану (типичная)"},
                    {"key": "keep_all",    "label": "Хранить все, менеджер выберет в КП"},
                ]
            }

        elif kind == "invalid_price":
            qtype = AnomalyKind.INVALID_PRICE
            text = (
                f"Подозрительная цена в строке «{sample_offer.mark or ''} "
                f"{sample_offer.dimension_raw or ''}» = {sample_offer.supplier_price}. "
                "Импортировать или пропустить?"
            )
            suggested = {
                "options": [
                    {"key": "skip",   "label": "Пропустить"},
                    {"key": "keep",   "label": "Импортировать как есть"},
                ]
            }

        elif kind == "empty_key":
            qtype = AnomalyKind.UNKNOWN_MARK_FORMAT
            text = (
                "Найдены строки без марки и размера — возможно "
                "продолжение предыдущей строки, заголовок, или мусор."
            )
            suggested = {
                "options": [
                    {"key": "skip",   "label": "Пропустить такие строки"},
                    {"key": "merge",  "label": "Слить с предыдущей строкой (продолжение)"},
                ]
            }

        else:
            qtype = AnomalyKind.UNKNOWN_MARK_FORMAT
            text = f"Неизвестная аномалия типа «{kind}» в группе {group_key}."
            suggested = None

        # Контекст: первые 5 строк группы целиком (raw_row)
        context_rows = []
        for o, _ in pairs[:5]:
            context_rows.append({
                "section":       o.section,
                "subcategory":   o.subcategory,
                "mark":          o.mark,
                "dimension_raw": o.dimension_raw,
                "unit":          o.unit,
                "price":         o.supplier_price,
                "source_ref":    o.source_ref.to_dict(),
                "raw_row":       o.raw_row,
                "anomaly_reason": o.anomaly_reason,
            })

        questions.append(ParsingQuestion(
            question_type=qtype,
            question_text=text,
            context_rows=context_rows,
            affected_offer_ids=offer_ids_in_q,
            suggested_answers=suggested,
        ))

    return questions

"""
harlan_ai.suppliers._base.types

Типы данных пайплайна загрузки прайса. Используются всеми поставщиками.
Соответствуют структуре БД из migration 20260504_supplier_pricing_v2.sql.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional, Any
from uuid import UUID


# ─── ИСТОЧНИК (SOURCE_REF) ────────────────────────────────────────────────
@dataclass(frozen=True)
class SourceRef:
    """Ссылка на исходную ячейку в файле прайса.

    Используется для трассировки: каждая запись в БД должна
    указывать на ячейку из которой она получена. Менеджер в diff-UI
    кликает → открывается прайс с подсветкой.
    """
    file: str           # имя файла, например "sortovojprokat.xls"
    sheet: str          # имя листа, например "Лист1"
    row: int            # 1-based индекс строки
    col: str            # буква колонки Excel, например "H"

    @property
    def cell(self) -> str:
        return f"{self.col}{self.row}"

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "sheet": self.sheet,
            "row": self.row,
            "col": self.col,
            "cell": self.cell,
        }


# ─── СПАРСЕННАЯ СТРОКА (OFFER) ────────────────────────────────────────────
@dataclass
class ParsedOffer:
    """Одна строка прайса после парсинга.

    Маппится 1:1 на supplier_price_offers в БД.
    """
    section: Optional[str]              # "Сортовой прокат"
    subcategory: Optional[str]          # "АРМАТУРА", "УГОЛОК НИЗКОЛЕГИР"
    mark: Optional[str]                 # "кл А1 А240", "Ст3 н/обр"
    dimension_raw: Optional[str]        # "12", "8 ; 12; 16", "25x25 6м"
    unit: Optional[str]                 # "т", "теор.т", "тыс.шт"
    supplier_price: Optional[float]     # ₽
    source_ref: SourceRef               # откуда эта строка
    raw_row: list[str]                  # оригинальные ячейки строки целиком
    has_anomaly: bool = False
    anomaly_reason: Optional[str] = None


# ─── АНОМАЛИИ ─────────────────────────────────────────────────────────────
class AnomalyKind(str, Enum):
    """Типы аномалий → создаются parsing_questions."""
    UNKNOWN_SUBCATEGORY        = "unknown_subcategory"
    UNKNOWN_HEADER             = "unknown_header"
    PRICE_ANOMALY              = "price_anomaly"
    DUPLICATE_DIFFERENT_PRICE  = "duplicate_with_different_price"
    UNKNOWN_UNIT               = "unknown_unit"
    INVALID_PRICE              = "invalid_price"
    INVALID_DIMENSION          = "invalid_dimension"
    UNKNOWN_MARK_FORMAT        = "unknown_mark_format"


# ─── ВОПРОС ПАРСЕРА ───────────────────────────────────────────────────────
@dataclass
class ParsingQuestion:
    """Вопрос парсера к менеджеру.

    Маппится на parsing_questions в БД. Менеджер отвечает в CRM
    → ответ применяется к offer-ам и (опционально) сохраняется
    как supplier_parsing_rule для будущих загрузок.
    """
    question_type: AnomalyKind
    question_text: str                  # человекочитаемый вопрос
    context_rows: list[dict]            # ±5 строк вокруг аномалии
    affected_offer_ids: list[UUID] = field(default_factory=list)
    suggested_answers: Optional[dict[str, Any]] = None

    def to_db_payload(self) -> dict:
        return {
            "question_type": self.question_type.value,
            "question_text": self.question_text,
            "context_rows": self.context_rows,
            "affected_offers": [str(x) for x in self.affected_offer_ids],
            "suggested_answers": self.suggested_answers,
        }


# ─── КОНТЕКСТ ЗАГРУЗКИ ────────────────────────────────────────────────────
@dataclass
class UploadContext:
    """Контекст одной загрузки одного файла.

    Создаётся CLI-скриптом или API-роутом перед запуском парсера.
    Парсер пишет в БД с этими идентификаторами.
    """
    tenant_id: UUID
    upload_id: UUID                     # ссылка на supplier_price_uploads.id
    supplier_id: UUID                   # ссылка на suppliers.id
    supplier_slug: str                  # для логов
    file_path: str                      # абсолютный путь .xls
    file_name: str                      # только имя без пути
    category_hint: Optional[str] = None # из имени файла, например "cvetmet"

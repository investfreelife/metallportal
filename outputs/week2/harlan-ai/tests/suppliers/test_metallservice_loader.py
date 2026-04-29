"""
tests/suppliers/test_metallservice_loader.py

Smoke-тесты парсера прайсов Металлсервиса. Используют FakeSupabase
(БД не требуется). Реальные .xls файлы должны лежать в
tests/fixtures/metallservice/. Если не лежат — тесты пропускаются.
"""
from __future__ import annotations
import uuid
from pathlib import Path
import pytest

from harlan_ai.suppliers.metallservice import MetallserviceLoader
from harlan_ai.suppliers._base.types import UploadContext
from harlan_ai.suppliers._base.source_ref import col_letter, make_source_ref


# ─── Юниты на утилиты ─────────────────────────────────────────────────────
def test_col_letter_basic():
    assert col_letter(0) == "A"
    assert col_letter(1) == "B"
    assert col_letter(25) == "Z"
    assert col_letter(26) == "AA"
    assert col_letter(701) == "ZZ"

def test_make_source_ref_returns_correct_cell():
    ref = make_source_ref("file.xls", "Лист1", row_zero_based=124, col_zero_based=7)
    assert ref.row == 125
    assert ref.col == "H"
    assert ref.cell == "H125"
    assert ref.to_dict()["cell"] == "H125"


# ─── Интеграционные ───────────────────────────────────────────────────────
SUPPLIER_FILES = [
    "cvetmet.xls",
    "engineering.xls",
    "kachestvst.xls",
    "krepezh.xls",
    "listovojprokat.xls",
    "metizy.xls",
    "nerzhaveika.xls",
    "profnastil.xls",
    "sortovojprokat.xls",
    "truby.xls",
]

# Минимальное ожидаемое число позиций для каждого файла (sanity check).
# Получено с помощью первого dry-run парсера 2026-04-27.
EXPECTED_MIN_OFFERS = {
    "cvetmet.xls":         300,
    "engineering.xls":     900,
    "kachestvst.xls":      100,
    "krepezh.xls":        3500,
    "listovojprokat.xls":  300,
    "metizy.xls":          300,
    "nerzhaveika.xls":    1100,
    "profnastil.xls":      100,
    "sortovojprokat.xls":  500,
    "truby.xls":          2800,
}


@pytest.mark.parametrize("filename", SUPPLIER_FILES)
def test_parser_runs_on_real_file(fixtures_dir, fake_sb, filename):
    fp = fixtures_dir / filename
    if not fp.exists():
        pytest.skip(f"fixture not found: {fp}")

    ctx = UploadContext(
        tenant_id=uuid.UUID("a1000000-0000-0000-0000-000000000001"),
        upload_id=uuid.uuid4(),
        supplier_id=uuid.uuid4(),
        supplier_slug="metallservice",
        file_path=str(fp),
        file_name=filename,
        category_hint=Path(filename).stem,
    )

    loader = MetallserviceLoader(fake_sb, ctx, dry_run=True)
    result = loader.run()

    assert result.offers_parsed > 0, f"парсер не нашёл ни одной строки в {filename}"
    expected_min = EXPECTED_MIN_OFFERS.get(filename, 50)
    assert result.offers_parsed >= expected_min, (
        f"в {filename} нашлось {result.offers_parsed} строк, "
        f"ожидалось хотя бы {expected_min}"
    )

    # source_ref должен быть валидным для всех offers
    # (получаем offers напрямую через _parse_file для проверки)
    raw_offers = loader._parse_file()
    for o in raw_offers[:50]:
        assert o.source_ref.file == filename
        assert o.source_ref.row >= 1
        assert o.source_ref.col in {"D", "I"}, (
            f"price column expected D or I, got {o.source_ref.col} "
            f"in row {o.source_ref.row}"
        )


def test_parser_detects_anomalies(fixtures_dir, fake_sb):
    """В sortovojprokat.xls должны найтись аномалии — там известно
    про подкатегорию "УГОЛОК НИЗКОЛЕГИР" со скачком цен."""
    fp = fixtures_dir / "sortovojprokat.xls"
    if not fp.exists():
        pytest.skip(f"fixture not found: {fp}")

    ctx = UploadContext(
        tenant_id=uuid.UUID("a1000000-0000-0000-0000-000000000001"),
        upload_id=uuid.uuid4(),
        supplier_id=uuid.uuid4(),
        supplier_slug="metallservice",
        file_path=str(fp),
        file_name="sortovojprokat.xls",
        category_hint="sortovojprokat",
    )
    loader = MetallserviceLoader(fake_sb, ctx, dry_run=True)
    result = loader.run()

    assert result.offers_with_anomaly > 0, (
        "в sortovojprokat.xls должны находиться аномалии "
        "(скачки цен или новые подкатегории)"
    )
    assert result.questions_created > 0, (
        "при наличии аномалий должны создаваться вопросы менеджеру"
    )


def test_parser_does_not_crash_on_missing_xlrd(monkeypatch, tmp_path, fake_sb):
    """Если xlrd не установлен — должна быть понятная ошибка."""
    import harlan_ai.suppliers.metallservice.loader as M
    monkeypatch.setattr(M, "xlrd", None)

    ctx = UploadContext(
        tenant_id=uuid.UUID("a1000000-0000-0000-0000-000000000001"),
        upload_id=uuid.uuid4(),
        supplier_id=uuid.uuid4(),
        supplier_slug="metallservice",
        file_path=str(tmp_path / "nonexistent.xls"),
        file_name="nonexistent.xls",
        category_hint="dummy",
    )
    loader = MetallserviceLoader(fake_sb, ctx, dry_run=True)
    with pytest.raises(RuntimeError, match="xlrd"):
        loader.run()


# ─── Тест анализатора аномалий ───────────────────────────────────────────
def test_anomaly_detector_finds_price_jump():
    from harlan_ai.suppliers._base.anomaly import AnomalyDetector
    from harlan_ai.suppliers._base.types import ParsedOffer
    from harlan_ai.suppliers._base.source_ref import make_source_ref

    src = make_source_ref("test.xls", "Лист1", 0, 3)

    offers = [
        ParsedOffer(section="X", subcategory="Y", mark="A1", dimension_raw="10",
                    unit="т", supplier_price=100.0, source_ref=src, raw_row=[]),
        ParsedOffer(section="X", subcategory="Y", mark="A1", dimension_raw="10",
                    unit="т", supplier_price=102.0, source_ref=src, raw_row=[]),
        ParsedOffer(section="X", subcategory="Y", mark="A1", dimension_raw="10",
                    unit="т", supplier_price=101.0, source_ref=src, raw_row=[]),
        # выброс — на 50% выше
        ParsedOffer(section="X", subcategory="Y", mark="A1", dimension_raw="10",
                    unit="т", supplier_price=151.0, source_ref=src, raw_row=[]),
    ]
    det = AnomalyDetector()
    det.detect(offers)
    # последний должен быть помечен
    assert offers[3].has_anomaly
    assert "price_jump" in (offers[3].anomaly_reason or "") or \
           "duplicate_diff_price" in (offers[3].anomaly_reason or "")


def test_anomaly_detector_finds_invalid_price():
    from harlan_ai.suppliers._base.anomaly import AnomalyDetector
    from harlan_ai.suppliers._base.types import ParsedOffer
    from harlan_ai.suppliers._base.source_ref import make_source_ref

    src = make_source_ref("test.xls", "Лист1", 0, 3)
    offers = [
        ParsedOffer(section="X", subcategory="Y", mark="Z", dimension_raw="1",
                    unit="т", supplier_price=None, source_ref=src, raw_row=[]),
        ParsedOffer(section="X", subcategory="Y", mark="Z", dimension_raw="1",
                    unit="т", supplier_price=99_999_999.0, source_ref=src, raw_row=[]),
    ]
    det = AnomalyDetector()
    det.detect(offers)
    assert all(o.has_anomaly for o in offers)

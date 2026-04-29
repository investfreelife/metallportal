#!/usr/bin/env python3
"""
harlan-ai/scripts/parse_supplier_pricing.py

CLI для запуска парсинга прайсов поставщика.

Использование:

    # Метать всё что можно
    python scripts/parse_supplier_pricing.py \
        --supplier metallservice \
        --files data/suppliers/metallservice/cvetmet.xls \
                data/suppliers/metallservice/sortovojprokat.xls

    # Dry-run (без записи в БД)
    python scripts/parse_supplier_pricing.py \
        --supplier metallservice \
        --files data/suppliers/metallservice/*.xls \
        --dry-run

    # Просто посмотреть открытые вопросы
    python scripts/parse_supplier_pricing.py --list-questions

Возвращает exit-код:
    0 — всё успешно
    1 — парсер упал на каком-то файле
    2 — ошибка конфигурации/окружения
"""

from __future__ import annotations
import argparse
import hashlib
import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

# делаем пакет импортируемым из корня harlan-ai
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from supabase import create_client, Client

from harlan_ai.suppliers.metallservice import MetallserviceLoader
from harlan_ai.suppliers._base.types import UploadContext


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("parse_supplier_pricing")


# ─── Регистрация поставщиков ──────────────────────────────────────────────
SUPPLIER_LOADERS = {
    "metallservice": MetallserviceLoader,
}


# ─── Хелперы ──────────────────────────────────────────────────────────────
def sb_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        log.error("SUPABASE_URL и SUPABASE_SERVICE_KEY должны быть в env")
        sys.exit(2)
    return create_client(url, key)


def tenant_id() -> uuid.UUID:
    raw = os.environ.get("TENANT_ID", "a1000000-0000-0000-0000-000000000001")
    return uuid.UUID(raw)


def file_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def category_hint_from_filename(filename: str) -> str:
    """cvetmet.xls → 'cvetmet'."""
    return Path(filename).stem.lower()


def get_supplier_id(sb: Client, slug: str) -> uuid.UUID:
    resp = sb.table("suppliers").select("id").eq("slug", slug).limit(1).execute()
    if not resp.data:
        log.error("supplier slug=%s not found in suppliers table", slug)
        sys.exit(2)
    return uuid.UUID(resp.data[0]["id"])


def create_upload_record(
    sb: Client,
    tenant: uuid.UUID,
    supplier_id: uuid.UUID,
    batch_id: uuid.UUID,
    file_path: str,
) -> uuid.UUID:
    """Создаёт запись в supplier_price_uploads, возвращает её id."""
    fh = file_hash(file_path)
    fname = Path(file_path).name
    fsize = os.path.getsize(file_path)
    cat = category_hint_from_filename(fname)

    resp = (
        sb.table("supplier_price_uploads")
        .insert({
            "tenant_id":         str(tenant),
            "supplier_id":       str(supplier_id),
            "batch_id":          str(batch_id),
            "file_name":         fname,
            "file_hash_sha256":  fh,
            "file_size_bytes":   fsize,
            "category_hint":     cat,
            "status":            "parsing",
        })
        .execute()
    )
    if not resp.data:
        # Скорее всего конфликт по unique (tenant, supplier, hash) — файл уже грузили
        log.warning("upload for %s (hash=%s) already exists, fetching existing id", fname, fh[:8])
        existing = (
            sb.table("supplier_price_uploads")
            .select("id")
            .eq("tenant_id", str(tenant))
            .eq("supplier_id", str(supplier_id))
            .eq("file_hash_sha256", fh)
            .limit(1)
            .execute()
        )
        if not existing.data:
            log.error("failed to create or find upload record for %s", fname)
            sys.exit(1)
        return uuid.UUID(existing.data[0]["id"])
    return uuid.UUID(resp.data[0]["id"])


# ─── List-questions ───────────────────────────────────────────────────────
def cmd_list_questions(sb: Client, tenant: uuid.UUID) -> int:
    resp = (
        sb.table("parsing_questions")
        .select("id, question_type, question_text, status, created_at")
        .eq("tenant_id", str(tenant))
        .eq("status", "open")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    if not resp.data:
        print("no open questions")
        return 0
    print(f"OPEN parsing_questions: {len(resp.data)}")
    print("─" * 80)
    for q in resp.data:
        print(f"  [{q['question_type']}] {q['question_text'][:100]}")
        print(f"     id={q['id']}  created={q['created_at']}")
    return 0


# ─── Главный command ──────────────────────────────────────────────────────
def cmd_parse(args: argparse.Namespace) -> int:
    if args.supplier not in SUPPLIER_LOADERS:
        log.error("unknown supplier: %s. Known: %s",
                  args.supplier, list(SUPPLIER_LOADERS.keys()))
        return 2

    LoaderCls = SUPPLIER_LOADERS[args.supplier]

    sb = sb_client()
    tenant = tenant_id()
    supplier_id = get_supplier_id(sb, args.supplier)
    batch_id = uuid.uuid4()

    log.info("supplier=%s tenant=%s batch=%s files=%d",
             args.supplier, tenant, batch_id, len(args.files))

    summary = {"ok": 0, "failed": 0, "results": []}

    for fp in args.files:
        if not os.path.isfile(fp):
            log.error("file not found: %s", fp)
            summary["failed"] += 1
            continue

        # создаём upload-запись
        if args.dry_run:
            upload_id = uuid.uuid4()
            log.info("DRY-RUN: simulated upload_id=%s for %s", upload_id, fp)
        else:
            upload_id = create_upload_record(sb, tenant, supplier_id, batch_id, fp)

        ctx = UploadContext(
            tenant_id=tenant,
            upload_id=upload_id,
            supplier_id=supplier_id,
            supplier_slug=args.supplier,
            file_path=fp,
            file_name=Path(fp).name,
            category_hint=category_hint_from_filename(Path(fp).name),
        )

        try:
            loader = LoaderCls(sb, ctx, dry_run=args.dry_run)
            result = loader.run()
            log.info("✅ %s", result.summary())
            summary["ok"] += 1
            summary["results"].append({
                "file": result.file_name,
                "parsed": result.offers_parsed,
                "anomalies": result.offers_with_anomaly,
                "questions": result.questions_created,
            })
        except Exception as e:
            log.exception("❌ failed for %s: %s", fp, e)
            summary["failed"] += 1
            if not args.dry_run:
                # помечаем upload как failed
                sb.table("supplier_price_uploads").update({
                    "status": "failed",
                    "error_message": str(e)[:500],
                }).eq("id", str(upload_id)).execute()

    # ─── Сводка ────────────────────────────────────────────────────
    print("\n" + "═" * 78)
    print(f"BATCH {batch_id}")
    print("═" * 78)
    print(f"  Files OK:     {summary['ok']}")
    print(f"  Files failed: {summary['failed']}")
    total_parsed = sum(r["parsed"] for r in summary["results"])
    total_anom = sum(r["anomalies"] for r in summary["results"])
    total_q = sum(r["questions"] for r in summary["results"])
    print(f"  Total offers parsed:    {total_parsed}")
    print(f"  Total with anomalies:   {total_anom}")
    print(f"  Total parsing_questions:{total_q}")
    print()
    print("Per file:")
    for r in summary["results"]:
        print(f"  {r['file']:30s}  parsed={r['parsed']:5d}  "
              f"anom={r['anomalies']:4d}  Q={r['questions']:3d}")
    print()
    if not args.dry_run:
        print(f"Открытые вопросы для менеджера:")
        print(f"  python {sys.argv[0]} --list-questions")
        print(f"Или в SQL:")
        print(f"  SELECT * FROM parsing_questions WHERE status='open' "
              f"AND supplier_id='{supplier_id}';")

    return 1 if summary["failed"] > 0 else 0


# ─── argparse ─────────────────────────────────────────────────────────────
def main() -> int:
    p = argparse.ArgumentParser(description="Parse supplier price-list .xls files")
    p.add_argument("--supplier", default="metallservice",
                   choices=list(SUPPLIER_LOADERS.keys()),
                   help="slug поставщика")
    p.add_argument("--files", nargs="+", default=[],
                   help="один или несколько .xls файлов")
    p.add_argument("--dry-run", action="store_true",
                   help="не писать в БД, только показать что нашли")
    p.add_argument("--list-questions", action="store_true",
                   help="вывести список открытых вопросов и выйти")
    args = p.parse_args()

    if args.list_questions:
        sb = sb_client()
        return cmd_list_questions(sb, tenant_id())

    if not args.files:
        p.error("укажите --files <FILE> [<FILE> ...] или используйте --list-questions")
    return cmd_parse(args)


if __name__ == "__main__":
    sys.exit(main())

-- ══════════════════════════════════════════════════════════════════
-- Migration: 20260519000000_products_catalog_sync.sql
-- Phase 0 / Week 2 — Каталожный sync: поля для δ-sync карточек МС
-- ══════════════════════════════════════════════════════════════════
-- Добавляет в products:
--   source_supplier_id  — ссылка на price_suppliers (откуда синкали)
--   supplier_product_id — артикул/slug карточки у поставщика
--   raw_html_hash       — sha256 HTML карточки для δ-sync
--   last_synced_at      — когда последний раз синкали
-- Делает products.supplier_id nullable: каталожные продукты не имеют
-- CRM-поставщика (они синкаются по source_supplier_id).
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. FK на справочник поставщиков каталога
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_supplier_id UUID
    REFERENCES price_suppliers(id) ON DELETE SET NULL;

-- 2. Артикул / slug карточки у поставщика (из URL или DOM)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_product_id TEXT;

-- 3. SHA-256 HTML карточки — основа δ-sync
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS raw_html_hash TEXT;

-- 4. Метка времени последней синхронизации
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 5. supplier_id → nullable (каталожные продукты не принадлежат CRM-аккаунту)
ALTER TABLE products
  ALTER COLUMN supplier_id DROP NOT NULL;

-- 6. Уникальный индекс — основа UPSERT-а
--    Partial index: только для каталожных продуктов (source_supplier_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_supplier_product
  ON products (source_supplier_id, supplier_product_id)
  WHERE source_supplier_id IS NOT NULL
    AND supplier_product_id IS NOT NULL;

-- 7. Индекс для быстрой выборки по источнику
CREATE INDEX IF NOT EXISTS idx_products_source_supplier
  ON products (source_supplier_id)
  WHERE source_supplier_id IS NOT NULL;

COMMIT;

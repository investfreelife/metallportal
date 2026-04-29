-- ============================================================================
-- Migration: 20260508000000_products_catalog_fields.sql
-- Phase 0 / Week 2 — Консолидированная: поля для каталожного sync МС
--
-- Объединяет ТЗ #18 (5 полей) + ТЗ #19 (raw_html_hash, supplier_id nullable,
-- UNIQUE index для UPSERT).
-- ============================================================================

BEGIN;

-- ── 1. Новые поля ──────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_product_id   TEXT,
  ADD COLUMN IF NOT EXISTS gost                  TEXT,
  ADD COLUMN IF NOT EXISTS source_url            TEXT,
  ADD COLUMN IF NOT EXISTS source_supplier_id    UUID REFERENCES price_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_html_hash         TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at        TIMESTAMPTZ;

COMMENT ON COLUMN products.supplier_product_id IS
  'Slug/артикул товара у поставщика (из URL mc.ru или прайса); для дедупликации';
COMMENT ON COLUMN products.gost IS
  'ГОСТ/ТУ товара (если указан отдельно от name/dimensions)';
COMMENT ON COLUMN products.source_url IS
  'URL страницы поставщика откуда взят товар';
COMMENT ON COLUMN products.source_supplier_id IS
  'FK на price_suppliers.id — поставщик-источник этого product';
COMMENT ON COLUMN products.raw_html_hash IS
  'SHA-256 HTML-блока товара; основа δ-sync (skip если hash не изменился)';
COMMENT ON COLUMN products.last_synced_at IS
  'Timestamp последней синхронизации из каталога/прайса поставщика';

-- ── 2. supplier_id → nullable ──────────────────────────────────────────────
-- Каталожные products не привязаны к CRM-аккаунту supplier

ALTER TABLE products
  ALTER COLUMN supplier_id DROP NOT NULL;

-- ── 3. Индексы ─────────────────────────────────────────────────────────────

-- UNIQUE partial index — основа UPSERT-логики upserter.py
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_supplier_product
  ON products (source_supplier_id, supplier_product_id)
  WHERE source_supplier_id IS NOT NULL
    AND supplier_product_id IS NOT NULL;

-- Быстрая выборка по источнику
CREATE INDEX IF NOT EXISTS idx_products_source_supplier
  ON products (source_supplier_id)
  WHERE source_supplier_id IS NOT NULL;

-- source_url для дедупликации
CREATE INDEX IF NOT EXISTS idx_products_source_url
  ON products (source_url)
  WHERE source_url IS NOT NULL;

-- last_synced для аналитики свежести
CREATE INDEX IF NOT EXISTS idx_products_last_synced
  ON products (last_synced_at)
  WHERE last_synced_at IS NOT NULL;

-- ── 4. Проверка ────────────────────────────────────────────────────────────
-- \d products → 6 новых колонок:
--   supplier_product_id, gost, source_url, source_supplier_id,
--   raw_html_hash, last_synced_at
-- supplier_id — теперь nullable

COMMIT;

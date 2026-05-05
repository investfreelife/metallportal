-- W2-25 (#c004 / catalog backend support): infrastructure migration
--
-- Goals:
--  1. Multi-image support — ADD products.image_urls jsonb, backfill из image_url.
--     image_url НЕ дропается (frontend ещё читает; миграция fronend — отдельный таск).
--  2. Composite indexes для самых частых query paths:
--     - products (category_id, is_active) — listing category + filter active
--     - price_items (product_id, unit) — get prices per product/unit
--     - categories (parent_id, is_active) — recursive category tree
--
-- Что НЕ делается этим файлом (см. REPORT c004):
--  - GIN на products.dimensions: колонка типа `text`, не jsonb (как предполагал ТЗ).
--    Escalated в REPORT — нужно отдельное решение (pg_trgm GIN ИЛИ конверсия в jsonb).
--  - to_tsvector(name) GIN: уже существует как `idx_products_name` (lesson 077: reconcile).
--
-- Pre-migration baseline (verified 2026-05-04 23:55 via Management API):
--   products             3697 rows
--     с image_url        164  rows (will receive image_urls = [image_url])
--     без image_url      3533 rows (will receive image_urls = [])
--   categories           190  rows
--   price_items          4016 rows
--
-- Idempotency: все DDL и UPDATE — IF NOT EXISTS / условные. Re-runnable.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Multi-image support
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill из image_url (idempotent — пишем только в пустые image_urls).
UPDATE products
   SET image_urls = jsonb_build_array(image_url)
 WHERE image_url IS NOT NULL
   AND image_url <> ''
   AND (image_urls IS NULL OR image_urls = '[]'::jsonb);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Composite indexes — самые частые query paths
-- ─────────────────────────────────────────────────────────────────────────

-- Listing products в категории (включая active filter).
-- Заменяет `idx_products_category` для query'ев с is_active condition;
-- старый btree(category_id) оставляем — он работает для unfiltered queries.
CREATE INDEX IF NOT EXISTS idx_products_category_active
  ON products (category_id, is_active);

-- Get prices per (product, unit) — typical product-detail page query.
CREATE INDEX IF NOT EXISTS idx_price_items_product_unit
  ON price_items (product_id, unit);

-- Recursive category tree query — speed up `parent_id` walk + active filter.
CREATE INDEX IF NOT EXISTS idx_categories_parent_active
  ON categories (parent_id, is_active);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Post-migration verification (manual run после apply):
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT count(*) FILTER (WHERE image_urls = '[]'::jsonb) AS empty_arr,
--        count(*) FILTER (WHERE jsonb_array_length(image_urls) = 1) AS one_img,
--        count(*) FILTER (WHERE jsonb_array_length(image_urls) > 1) AS many_img,
--        count(*) AS total
--   FROM products;
-- Ожидаем: empty_arr ≈ 3533, one_img ≈ 164, many_img = 0, total = 3697.
--
-- SELECT indexname FROM pg_indexes WHERE schemaname='public'
--   AND indexname IN ('idx_products_category_active',
--                     'idx_price_items_product_unit',
--                     'idx_categories_parent_active');
-- Ожидаем 3 строки.

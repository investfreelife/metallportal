-- c012 #2: Add `final_price` к price_items + backfill `supplier_price`.
--
-- Existing schema (verified 2026-06-06):
--   - supplier_id UUID NOT NULL                — already populated (12083 rows mapped)
--   - supplier_price NUMERIC NULLABLE          — column exists, all 12083 rows NULL
--   - markup_pct NUMERIC NOT NULL              — per-item legacy markup, kept as-is
--   - base_price NUMERIC NOT NULL              — actual displayed/charged price
--   - final_price                              — does NOT yet exist
--
-- Strategy:
--   - Backfill supplier_price = base_price for rows where supplier_price IS NULL
--     (treat current base_price as the supplier-quoted price; markup will be
--     applied through suppliers.markup_percent going forward).
--   - Add final_price column. Backfill = base_price (existing displayed value).
--   - Going forward, trigger computes final_price = supplier_price * (1 + markup_percent/100).
--   - `markup_pct` per-item column kept untouched (legacy/per-line override
--     mechanism); orthogonal к suppliers.markup_percent (per-supplier default).

BEGIN;

-- 1. Add final_price (nullable for backfill)
ALTER TABLE public.price_items
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(12, 2);

-- 2. Backfill supplier_price = base_price where NULL (preserves existing prices)
UPDATE public.price_items
   SET supplier_price = base_price
 WHERE supplier_price IS NULL;

-- 3. Backfill final_price = base_price (initial, markup_percent = 0 на suppliers)
UPDATE public.price_items
   SET final_price = base_price
 WHERE final_price IS NULL;

-- 4. NOT NULL constraints (after backfill)
ALTER TABLE public.price_items
  ALTER COLUMN supplier_price SET NOT NULL,
  ALTER COLUMN final_price SET NOT NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_price_items_supplier ON public.price_items (supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_items_product_supplier ON public.price_items (product_id, supplier_id);

COMMIT;

-- Post-migration verify:
-- SELECT count(*),
--        count(*) FILTER (WHERE supplier_price IS NULL) AS null_sp,
--        count(*) FILTER (WHERE final_price IS NULL) AS null_fp,
--        count(*) FILTER (WHERE final_price = base_price) AS final_eq_base
--   FROM price_items;
-- → 12083 / 0 / 0 / 12083 (all rows have supplier_price + final_price = base_price)

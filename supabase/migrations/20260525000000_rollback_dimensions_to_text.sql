-- W2-26 #c006 Block 2 ROLLBACK: dimensions JSONB → text
--
-- WHY: Block 2 (`20260523000000_dimensions_text_to_jsonb.sql`) broke
-- production catalog pages. Frontend code in:
--   - app/catalog/[category]/[subcategory]/page.tsx:41,792
--   - components/catalog/ProductCard.tsx:93
--   - components/catalog/ProductDetailView.tsx:113-115
--   - components/catalog/NavesProductDetail.tsx:36
--   - components/catalog/ProductTable.tsx:205
--   - components/catalog/SpecsTable.tsx:16
--   - lib/database.types.ts:159 (declares `string | null`)
-- ...renders `product.dimensions` directly as React child. After Block 2
-- type change, Supabase REST returns JSONB as JS object → React throws
-- (#31 "Objects are not valid as a React child") → 500 on category pages.
--
-- Detected by playwright `nav-data-driven` test (PR #57 CI):
--   `/catalog/gotovye-konstruktsii/navesy/navesy-s-hozblokom` → 500
--   `/catalog/sortovoy-prokat/otsinkovannyy-prokat/list-otsinkovannyy` → 500
--
-- Rollback strategy:
--   1. Drop `idx_products_dimensions_gin` (GIN на text не работает)
--   2. ALTER COLUMN dimensions TYPE text USING ::text
--      (jsonb cast to text → JSON-formatted string, валидно для column type)
--   3. Drop NOT NULL + DEFAULT (status quo ante)
--   4. Convert empty '{}' JSON strings back to NULL (matches pre-migration nullability)
--
-- Block 1 (data-fix, navesy + armatura) — KEPT. Block 3 (pgvector) — KEPT.
-- They don't depend on column type.
--
-- TODO (escalation): Re-attempt type change after frontend is updated to
-- handle jsonb objects (mini-PR `c00X_frontend-jsonb-dimensions-support`).

BEGIN;

DROP INDEX IF EXISTS idx_products_dimensions_gin;

ALTER TABLE products ALTER COLUMN dimensions DROP NOT NULL;
ALTER TABLE products ALTER COLUMN dimensions DROP DEFAULT;

ALTER TABLE products
  ALTER COLUMN dimensions TYPE text
  USING dimensions::text;

-- Restore NULL semantics (Block 2 had backfilled NULLs to '{}')
UPDATE products SET dimensions = NULL WHERE dimensions = '{}';

COMMIT;

-- Post-rollback verify:
-- SELECT data_type, is_nullable, column_default FROM information_schema.columns
--   WHERE table_name='products' AND column_name='dimensions';
-- Expected: text | YES | NULL
--
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_products_dimensions_gin';
-- Expected: empty
--
-- Block 1 data still JSON-formatted strings in text — frontend renders as text
-- (matches pre-c006 behavior for products with JSON.stringify dimensions).

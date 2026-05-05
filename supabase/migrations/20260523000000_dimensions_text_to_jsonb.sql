-- W2-26 #c006 Block 2: dimensions TEXT → JSONB type migration + GIN index
--
-- Prerequisite: #c006 Block 1A (navesy) + Block 1B (armatura) executed,
-- pre-flight `count where not jsonb-shaped = 0` verified.
--
-- Effects:
--   1. ALTER COLUMN type TEXT → JSONB (cast via `::jsonb`)
--   2. SET DEFAULT '{}' for new rows (NULL safety)
--   3. Backfill remaining NULL → '{}'
--   4. NOT NULL constraint
--   5. CREATE INDEX gin (dimensions) — c004's escalation #1 finally unblocks
--
-- Cross-coordinator: existing seed pipelines (Иван/Артём/Кирилл) write
-- `JSON.stringify({...})` into dimensions; PostgreSQL accepts text→jsonb
-- cast on INSERT transparently. No breaking changes for them.

BEGIN;

-- 1. Type change (cast all existing values via ::jsonb)
ALTER TABLE products
  ALTER COLUMN dimensions TYPE jsonb
  USING (
    CASE
      WHEN dimensions IS NULL OR dimensions = '' THEN '{}'::jsonb
      ELSE dimensions::jsonb
    END
  );

-- 2. Default for new rows
ALTER TABLE products
  ALTER COLUMN dimensions SET DEFAULT '{}'::jsonb;

-- 3. Backfill NULL → '{}' (in case any slipped through)
UPDATE products
   SET dimensions = '{}'::jsonb
 WHERE dimensions IS NULL;

-- 4. NOT NULL constraint
ALTER TABLE products
  ALTER COLUMN dimensions SET NOT NULL;

-- 5. GIN index (c004 escalation #1: finally unblocked)
CREATE INDEX IF NOT EXISTS idx_products_dimensions_gin
  ON products USING gin (dimensions);

COMMIT;

-- Post-migration verify:
-- SELECT data_type FROM information_schema.columns
--  WHERE table_name='products' AND column_name='dimensions';
-- → "jsonb"
--
-- EXPLAIN ANALYZE
-- SELECT id FROM products WHERE dimensions @> '{"thickness_mm": 5}'::jsonb LIMIT 100;
-- → uses idx_products_dimensions_gin Bitmap Index Scan

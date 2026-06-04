-- W2-26 #c006 Block 1B: data fix — 57 armatura products with `⌀N` in dimensions
--
-- Problem (from #c005 pre-flight):
--   57 rows in `armatura-riflenaya-a500s-a3` (and similar) store diameter as
--   `⌀10`, `⌀12`, `⌀22.5`, ... directly in `dimensions` — not JSON.
--
-- Pre-state (verified 2026-05-05 12:35 via Management API):
--   `armatura-riflenaya-a500s-a3` — 57 rows.
--   Format observed: only `⌀N` (length already encoded into slug, e.g.
--   `armatura-22-a3-a500s-11700` → length=11700 mm).
--
-- Strategy: parse diameter from `⌀N(.M)?` → JSON object, preserve original
-- as `source_format` for traceability:
--   "⌀12"   → {"diameter_mm": 12,    "source_format": "⌀12"}
--   "⌀5.5"  → {"diameter_mm": 5.5,   "source_format": "⌀5.5"}
--   "⌀22.5" → {"diameter_mm": 22.5,  "source_format": "⌀22.5"}
--
-- Idempotent: regex condition skips already-converted JSON rows.

BEGIN;

UPDATE products
   SET dimensions = jsonb_build_object(
         'diameter_mm', NULLIF(REGEXP_REPLACE(dimensions, '[^0-9.]', '', 'g'), '')::numeric,
         'source_format', dimensions
       )::text
 WHERE dimensions ~ '^⌀[0-9]+(\.[0-9]+)?$'
   AND NOT (dimensions ~* '^\s*[\{\[]');

COMMIT;

-- Post-migration verification:
-- SELECT count(*) AS still_bad FROM products
--   WHERE dimensions IS NOT NULL AND dimensions <> ''
--     AND NOT (dimensions ~* '^\s*[\{\[]');
-- Expected: 0 (combined with navesy fix)

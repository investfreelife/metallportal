-- W2-26 #c006 Block 1A: data fix — 137 navesy products with non-JSON dimensions
--
-- Problem (from #c005 pre-flight):
--   137 rows under `navesy*` categories store construction-variant labels
--   («Без ферм», «С параллельным усилением», «С треугольным усилением», ...)
--   directly in `dimensions` text column — these are not JSON.
--
-- Pre-state (verified 2026-05-05 12:35 via Management API):
--   navesy-besedka          26 rows
--   navesy-dlya-avtomobilya 30 rows
--   navesy-dlya-dachi       26 rows
--   navesy-dlya-parkovok    30 rows
--   navesy-s-hozblokom      25 rows
--   ───────────────────────────────
--   total                   137 rows
--
-- Strategy: wrap original text into JSON object preserving information:
--   "С параллельным усилением" → {"description": "...", "product_type": "naves"}
--
-- Idempotent: only processes rows where dimensions still text (not '{...}').

BEGIN;

UPDATE products
   SET dimensions = jsonb_build_object(
         'description', dimensions,
         'product_type', 'naves'
       )::text
 WHERE category_id IN (
         WITH RECURSIVE navesy_tree AS (
           SELECT id FROM categories WHERE slug = 'navesy'
           UNION ALL
           SELECT c.id
             FROM categories c
             JOIN navesy_tree nt ON c.parent_id = nt.id
         )
         SELECT id FROM navesy_tree
       )
   AND dimensions IS NOT NULL
   AND dimensions <> ''
   AND NOT (dimensions ~* '^\s*[\{\[]');

COMMIT;

-- Post-migration verification:
-- SELECT count(*) FROM products
--   WHERE dimensions IS NOT NULL AND dimensions <> ''
--     AND NOT (dimensions ~* '^\s*[\{\[]')
--     AND category_id IN (...navesy descendants...);
-- Expected: 0

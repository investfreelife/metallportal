-- c029 P0 ROLLBACK: clear bogus images на gotovye-konstruktsii subtree.
--
-- Артём в i016 (commit 049975c) bulk re-bind'нул images на 146 categories,
-- задел навесы — все 137 products в `gotovye-konstruktsii/*` стали показывать
-- одинаковый `_placeholders/construction-tower.jpg` (рабочие в касках —
-- не navesy product photo).
--
-- Sergey: «откати назад! навесы и фото что я сейчас загружаю не трогаются
-- без команды!»
--
-- Rollback target: image_url + image_urls → NULL для products в subtree
-- gotovye-konstruktsii. Other categories' i016 changes (арматура / лист /
-- труба) остаются untouched per ТЗ §Запреты.
--
-- Note: products.image_alt column does NOT exist в schema (ТЗ упоминает,
-- но реальной колонки нет — verified via information_schema).
--
-- Note: products.image_urls имеет NOT NULL constraint — set к '[]'::jsonb
-- (empty array) вместо NULL.

BEGIN;

WITH RECURSIVE descendants AS (
  SELECT id FROM public.categories
   WHERE slug = 'gotovye-konstruktsii' AND parent_id IS NULL
  UNION ALL
  SELECT c.id FROM public.categories c
    JOIN descendants d ON c.parent_id = d.id
)
UPDATE public.products
   SET image_url  = NULL,
       image_urls = '[]'::jsonb,
       updated_at = NOW()
 WHERE category_id IN (SELECT id FROM descendants);

COMMIT;

-- Post-migration verify (expected: 0):
-- WITH RECURSIVE d AS (
--   SELECT id FROM categories WHERE slug = 'gotovye-konstruktsii' AND parent_id IS NULL
--   UNION ALL SELECT c.id FROM categories c JOIN d ON c.parent_id = d.id
-- )
-- SELECT COUNT(*) FROM products WHERE category_id IN (SELECT id FROM d) AND image_url IS NOT NULL;
-- → 0

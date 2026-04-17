BEGIN;

-- ========================================
-- 1. Re-point products: old slug → new slug
--    (only where slugs DIFFER)
-- ========================================

-- truba-vgp (220) → truby-vgp
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='truby-vgp')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='truba-vgp');

-- truba-besshovnaya (162) → truby-besshovnye
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='truby-besshovnye')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='truba-besshovnaya');

-- truba-svarnaya (18) → truby-es
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='truby-es')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='truba-svarnaya');

-- armatura-stalnaya (10) → armatura-a500
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='armatura-a500')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='armatura-stalnaya');

-- truba-profilnaya (2) → truby-profilnye
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='truby-profilnye')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='truba-profilnaya');

-- balka-dvutavr (1) → balka
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='balka')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='balka-dvutavr');

-- ugolok-ravnopolochny (1) → ugolok
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='ugolok')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='ugolok-ravnopolochny');

-- list-otsinkovanny (1) → list-ocink
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='list-ocink')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='list-otsinkovanny');

-- list-goryachekatany (1) → list-gk
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='list-gk')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='list-goryachekatany');

-- lazernaya (0) → lazernaya-rezka
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='lazernaya-rezka')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='lazernaya');

-- gibka (0) → gibka-metalla
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='gibka-metalla')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='gibka');

-- setka-rabica (0) → rabica
UPDATE products SET category_id =
  (SELECT id FROM categories WHERE slug='rabica')
WHERE category_id =
  (SELECT id FROM categories WHERE slug='setka-rabica');

-- ========================================
-- 2. Re-parent child categories from old parents
--    (polosa-stalnaya, shveller, setka-kladochnaya
--     etc. stay in DB, just get new parent)
-- ========================================

-- Children of listy-i-plity → listovoj-prokat
UPDATE categories SET parent_id =
  (SELECT id FROM categories WHERE slug='listovoj-prokat')
WHERE parent_id =
  (SELECT id FROM categories WHERE slug='listy-i-plity');

-- Children of balki-i-shvellery → fasonnyj-prokat
UPDATE categories SET parent_id =
  (SELECT id FROM categories WHERE slug='fasonnyj-prokat')
WHERE parent_id =
  (SELECT id FROM categories WHERE slug='balki-i-shvellery');

-- Children of ugolki-i-polosy → sortovoj-prokat
UPDATE categories SET parent_id =
  (SELECT id FROM categories WHERE slug='sortovoj-prokat')
WHERE parent_id =
  (SELECT id FROM categories WHERE slug='ugolki-i-polosy');

-- ========================================
-- 3. DELETE old categories (now childless & productless)
-- ========================================
DELETE FROM categories WHERE slug IN (
  'listy-i-plity',
  'balki-i-shvellery',
  'ugolki-i-polosy',
  'truba-vgp',
  'truba-profilnaya',
  'truba-svarnaya',
  'truba-besshovnaya',
  'armatura-stalnaya',
  'balka-dvutavr',
  'ugolok-ravnopolochny',
  'ugolok-neravnopolochny',
  'list-goryachekatany',
  'list-holodnokatany',
  'list-otsinkovanny',
  'list-riflyony',
  'lazernaya',
  'gibka',
  'setka-rabica'
);

COMMIT;

-- Verify
SELECT COUNT(*) as total_categories FROM categories;
SELECT COUNT(*) as orphan_products FROM products WHERE category_id IS NULL;

-- W2-26 #i013: Image coverage placeholders для топ-3 L1 (battle mode day 1, applied 2026-05-06).
--
-- Bulk UPDATE products.image_url для всех products в 56 L3 leaves
-- (исключая armatura-riflenaya-a500s-a3 — already 100% covered).
--
-- Per ТЗ #i013 (battle mode launch 12 мая):
--   Цель: ≥ 80% coverage (минимум 1 image per L3 leaf).
--   Approach: rotate 2 generic industrial photos между L3 (placeholder coverage,
--   не unique-per-product). Future #i014 — заменить per-category specific photos.
--
-- Safety guard: WHERE image_url IS NULL OR image_url = '' (НЕ overwrite existing).
-- Narrow exception к lesson 075 (image enrichment без overwrite, как i011 dimensions).
--
-- ALREADY APPLIED to production DB 2026-05-06 12:40 via Management API (HTTP 201).
-- Migration committed для git history + future replay if needed.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT cat_slug, image_url FROM (VALUES
    ('profnastil-okrashennyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('profnastil-otsinkovannyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('profnastil-nerzhaveyuschiy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('krug-nerzhaveyuschiy-nikel', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('krug-konstruktsionnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('krug-zharoprochnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('ugolok-ravnopolochnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('balki-dvutavr', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('balki-dvutavr-nizkolegirovannye', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('polosa-g-k', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('shveller-goryachekatanyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('list-otsinkovannyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('shestigrannik-konstruktsionnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('ugolok-ravnopolochnyy-nizkolegirovannyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('shveller-gnutyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('shestigrannik-nerzhaveyuschiy-nikel', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('shveller-nizkolegirovannyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('krug-instrumentalnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('armatura-gladkaya-a240-a1', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('ugolok-neravnopolochnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('ugolok-nerzhaveyuschiy-nikelsoderzhaschiy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('polosa-g-k-otsinkovannaya', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('katanka', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('krug-otsinkovannyy-gk', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('armatura-a800', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('shestigrannik-zharoprochnyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-krug', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-list', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-plita', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-profil-stroy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-truba', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('bronza-krug', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('latun-list', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('latun-krug', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-ugolok', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('med-shina', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-list-riflenyy', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('med-list', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-shina', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('med-krug', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('med-truba', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('latun-shestigrannik', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-folga', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('latun-truba', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('latun-lenta', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-kvadrat', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('latun-kvadrat', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-shestigrannik', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-provoloka', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-list-pvl', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-chushka', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('med-lenta', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-profil-vent', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-shveller', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg'),
    ('alyuminiy-tavr', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-warehouse-1.jpg'),
    ('alyuminiy-lenta', 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/product-images/_placeholders/industrial-frame-2.jpg')
  ) AS t(cat_slug, image_url)
  LOOP
    UPDATE products
    SET image_url = r.image_url
    WHERE category_id = (SELECT id FROM categories WHERE slug = r.cat_slug)
      AND is_active = true
      AND (image_url IS NULL OR image_url = '');
  END LOOP;
END $$;

COMMENT ON TABLE products IS 'W2-26 #i013: image_url placeholders для 56 L3 leaves в top-3 L1 (battle mode day 1).';

-- W2-19: создание L2 list-dupleksnyy под существующей L1 dupleksnaya-stal.
--
-- Source: ТЗ #009 (approve all 5 questions REPORT #008 Part 3 = recommendations).
--
-- dupleksnaya-stal L1 (sort=60, parent=null) была пустой — pre-allocated slot
-- (identical pattern to mostovaya-stal L1 в REPORT #006 / ТЗ #007).
--
-- DUPLEX (двухфазная аустенито-ферритная) — специальный класс stainless с
-- distinct физико-химическими свойствами (PREN >35, atmospheric corrosion +
-- chloride stress-cracking resistance). Семантически отдельная категория от
-- обычной austenitic 304/316.
--
-- Initial seed: 22 SKU (DUPLEX 2205 / 2507, thickness 4-50, w×l = 1500×6000).
-- Категория готова к расширению: sibling L2 для truba/krug/list-rifelnyy duplex.
--
-- L1 → L2-with-products pattern (depth=2, как list-mostostroitelnyy под mostovaya-stal).

DO $$
DECLARE
  v_dupleks_id uuid;
BEGIN
  SELECT id INTO v_dupleks_id FROM categories WHERE slug = 'dupleksnaya-stal';
  IF v_dupleks_id IS NULL THEN
    RAISE EXCEPTION 'Parent category dupleksnaya-stal (L1) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES (
    'list-dupleksnyy',
    'Лист дуплексный',
    v_dupleks_id,
    1,
    true
  )
  ON CONFLICT (slug) DO NOTHING;
END $$;

COMMENT ON TABLE categories IS 'W2-19: list-dupleksnyy L2 added under dupleksnaya-stal L1.';

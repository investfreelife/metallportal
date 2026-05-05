-- W2-25: создание L2 truby-profilnye под существующей truby L1.
--
-- Per ТЗ #018 (approve all 5 questions REPORT #017 = recommended).
--
-- Existing children под truby L1 (sort=110):
--   truby-g-d (sort=1) — горячедеформированные
--   truby-kh-d (sort=2) — холоднодеформированные
--   vgp-elektrosvarnye-truby (sort=3)
--   truby-elektrosvarnye-nizkolegirovannye (sort=4)
--   truby-otsinkovannye (sort=5)
--   truby-nerzhaveyuschie (sort=6)
--   truby-chugunnye (sort=7)
--   truby-profilnye (sort=8) ← NEW (квадратные/прямоугольные/плоскоовальные)
--
-- ВГП source (#018) содержит ~215 профильных труб (квадратных/прямоугольных/
-- плоскоовальных). Семантически отдельная от круглых — другие ГОСТ
-- (8645-68 квадратные, 8639-82 прямоугольные).
--
-- Lesson 090: ancestor chain activation (idempotent UPDATE).
-- Lesson 091: structure-first — все L1/L2 уже existed pre-active, миграция
-- только добавляет новую L2 без изменения существующих.

-- Step 1: Activate ancestor chain (idempotent)
UPDATE categories SET is_active = true
WHERE slug IN (
  'truby',
  'vgp-elektrosvarnye-truby',
  'truby-elektrosvarnye-nizkolegirovannye',
  'truby-otsinkovannye'
)
AND is_active = false;

-- Step 2: Insert new L2 truby-profilnye
DO $$
DECLARE
  v_truby_id uuid;
BEGIN
  SELECT id INTO v_truby_id FROM categories WHERE slug = 'truby';
  IF v_truby_id IS NULL THEN
    RAISE EXCEPTION 'Parent category truby (L1) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES ('truby-profilnye', 'Трубы профильные', v_truby_id, 8, true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true;
END $$;

COMMENT ON TABLE categories IS 'W2-25: truby-profilnye L2 added under truby L1 + ancestor chain activation.';

-- W2-16: 6 L3-категорий под provoloka-kanaty (id ee312f7a-...,
-- L2 child of metizy fc3d6054-...).
--
-- До этой миграции parent_id=ee312f7a имел 0 children. Создаём 6 L3
-- для разноса ~162 SKU проволоки разной природы по типу/применению.
--
-- Sort_order по volume (predicted ~):
--   1. provoloka-nerzhaveyuschaya          (~100 SKU — самый крупный
--                                           subset: 12Х18Н10Т, AISI 304/...,
--                                           включая сварочную ER316L/ER308)
--   2. provoloka-pruzhinnaya               (24 — ГОСТ 9389 + ГОСТ 14963 60С2А)
--   3. provoloka-vr-1                      (21 — ВР-1 для арматурных изделий)
--   4. provoloka-nikhromovaya              (9 — Х15Н60, Х20Н80-Н)
--   5. provoloka-alyuminievaya             (6 — АД1)
--   6. provoloka-vysokoe-soprotivlenie     (2 — Х27Ю5Т)
--
-- Имена для slug — короткие; полные display-имена в `name` column для UI.

DO $$
DECLARE
  v_provoloka_id uuid;
BEGIN
  SELECT id INTO v_provoloka_id FROM categories WHERE slug = 'provoloka-kanaty';
  IF v_provoloka_id IS NULL THEN
    RAISE EXCEPTION 'Parent category provoloka-kanaty (L2) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES
    ('provoloka-nerzhaveyuschaya',     'Проволока нержавеющая',                       v_provoloka_id, 1, true),
    ('provoloka-pruzhinnaya',          'Проволока качественная пружинная',            v_provoloka_id, 2, true),
    ('provoloka-vr-1',                 'Проволока Вр-1',                              v_provoloka_id, 3, true),
    ('provoloka-nikhromovaya',         'Проволока нихромовая',                        v_provoloka_id, 4, true),
    ('provoloka-alyuminievaya',        'Проволока алюминиевая',                       v_provoloka_id, 5, true),
    ('provoloka-vysokoe-soprotivlenie','Проволока из сплавов с высоким сопротивлением', v_provoloka_id, 6, true)
  ON CONFLICT (slug) DO NOTHING;
END $$;

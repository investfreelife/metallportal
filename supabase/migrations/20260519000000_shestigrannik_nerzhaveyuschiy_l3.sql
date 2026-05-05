-- W2-26 #i008: 2 NEW L3 categories для нерж шестигранника.
--
-- Source: Drive Doc «Нержавеющая сталь» (mega 2.5 MB) — 45 шестигранник нерж SKU
-- (43 никельсодержащих + 2 безникелевых жаропрочных), отсутствуют в DB как category.
--
-- Pre-flight (catalog-structure-map.md snapshot 2026-05-04 23:45 + verify 2026-05-05):
--   sortovoy-prokat L1 [active, sort=10]
--     shestigrannik L2 [active, sort=7, 61 deep products]
--       shestigrannik-konstruktsionnyy L3 [active, sort=1, 61 products] ← existing
--       (NEW)  shestigrannik-zharoprochnyy
--       (NEW)  shestigrannik-nerzhaveyuschiy-nikel
--
-- Lesson 091 compliance: NO new L1/L2 — только L3 под existing active L2 (allowed without escalation).
-- Lesson 090 ancestor chain verified: sortovoy-prokat → shestigrannik оба active.

DO $$
DECLARE
  v_shest_id uuid;
BEGIN
  SELECT id INTO v_shest_id FROM categories WHERE slug = 'shestigrannik';
  IF v_shest_id IS NULL THEN
    RAISE EXCEPTION 'Parent shestigrannik L2 not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES
    ('shestigrannik-zharoprochnyy',         'Шестигранник жаропрочный нержавеющий г/к', v_shest_id, 2, true),
    ('shestigrannik-nerzhaveyuschiy-nikel', 'Шестигранник нержавеющий никельсодержащий г/к', v_shest_id, 3, true)
  ON CONFLICT (slug) DO NOTHING;
END $$;

COMMENT ON TABLE categories IS 'W2-26 #i008: 2 NEW L3 — shestigrannik-zharoprochnyy + shestigrannik-nerzhaveyuschiy-nikel под shestigrannik L2.';

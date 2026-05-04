-- W2-20: создание L2 shestigrannik + L3 shestigrannik-konstruktsionnyy.
--
-- Per ТЗ #011 (approve all 5 questions REPORT #010 = recommended options).
--
-- Sortovoy-prokat L1 уже содержит armatura-katanka (1), balka-shveller (2),
-- ugolok (3), krug (4), polosa-kvadrat (5), otsinkovannyy-prokat (6).
-- Шестигранник fits sibling к krug — L2 sort=7.
--
-- Pattern parity с krug: L2 + L3 (depth=3). Future addition possibility:
-- shestigrannik-nerzhaveyuschiy / -zharoprochnyy / -instrumentalnyy / etc.
-- как sibling L3 без reorganize.
--
-- Sort_order=1 для L3 — первый продуктовый sub-type под shestigrannik.

DO $$
DECLARE
  v_sortovoy_id uuid;
  v_shestigr_id uuid;
BEGIN
  SELECT id INTO v_sortovoy_id FROM categories WHERE slug = 'sortovoy-prokat';
  IF v_sortovoy_id IS NULL THEN
    RAISE EXCEPTION 'Parent category sortovoy-prokat (L1) not found';
  END IF;

  -- L2 shestigrannik
  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES ('shestigrannik', 'Шестигранник', v_sortovoy_id, 7, true)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_shestigr_id FROM categories WHERE slug = 'shestigrannik';

  -- L3 shestigrannik-konstruktsionnyy
  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES ('shestigrannik-konstruktsionnyy', 'Шестигранник конструкционный г/к', v_shestigr_id, 1, true)
  ON CONFLICT (slug) DO NOTHING;
END $$;

COMMENT ON TABLE categories IS 'W2-20: shestigrannik L2 + shestigrannik-konstruktsionnyy L3 added.';

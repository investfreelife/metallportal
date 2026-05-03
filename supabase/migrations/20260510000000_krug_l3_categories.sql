-- W2-15: 5 L3-категорий под krug (id 72422e83-..., L2, sort=4).
--
-- До этой миграции parent_id=72422e83 имел 0 children. Создаём 5 L3
-- для разноса 650 SKU круга г/к по типу стали.
--
-- Sort-order — по предполагаемой частоте использования (самые частые
-- — наверху), согласовано в чате к W2-15:
--   1. konstruktsionnyy   (~350 SKU: углерод Ст3 + лег. Ст20-45/40Х/...
--                          + никел. 40ХН/12ХН3А/40ХН2МА/12Х2Н4А)
--   2. nerzhaveyuschiy    (~80: 12Х18Н10Т, AISI 304/321/316L/..., 14Х17Н2)
--   3. zharoprochnyy      (~80: 20Х13, 30Х13, 40Х13, 95Х18, 12Х13, 08Х13-Ш)
--   4. instrumentalnyy    (~30: У8А, 9ХС)
--   5. otsinkovannyy-gk   (~10: Ст3 + оцинкованный)
--
-- Backlog: возможен будущий split krug-konstruktsionnyy →
-- krug-uglerodistyy (Ст3) + krug-konstruktsionnyy-legirovannyy если
-- угол. Ст3 имеет другой UX-flow (стройка vs машиностроение). Пока
-- single L3 + 308 redirects при будущей миграции.

DO $$
DECLARE
  v_krug_id uuid;
BEGIN
  SELECT id INTO v_krug_id FROM categories WHERE slug = 'krug';
  IF v_krug_id IS NULL THEN
    RAISE EXCEPTION 'Parent category krug (L2) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES
    ('krug-konstruktsionnyy',     'Круг конструкционный г/к',                 v_krug_id, 1, true),
    ('krug-nerzhaveyuschiy-nikel','Круг нержавеющий никельсодержащий г/к',    v_krug_id, 2, true),
    ('krug-zharoprochnyy',        'Круг жаропрочный нержавеющий г/к',         v_krug_id, 3, true),
    ('krug-instrumentalnyy',      'Круг инструментальный г/к',                v_krug_id, 4, true),
    ('krug-otsinkovannyy-gk',     'Круг оцинкованный г/к',                    v_krug_id, 5, true)
  ON CONFLICT (slug) DO NOTHING;
END $$;

COMMENT ON TABLE categories IS 'W2-15: 5 L3 children added under krug (sort_order: konstruktsionnyy → nerzhaveyuschiy → zharoprochnyy → instrumentalnyy → otsinkovannyy-gk).';

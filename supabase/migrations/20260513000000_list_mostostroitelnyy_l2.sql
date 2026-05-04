-- W2-18: создание L2 list-mostostroitelnyy под существующей L1 mostovaya-stal.
--
-- Source: ТЗ #007 (approve all 5 questions REPORT #006 = option A).
--
-- mostovaya-stal L1 (sort=50, parent=null) была пустой (0 children, 0 products) —
-- предусмотренный slot для специальной мостостроительной стали (15ХСНД,
-- 14Г2АФ, 10ХСНД с certified ударной вязкостью при −60°C).
--
-- Initial seed: 1 SKU (15ХСНД 30×2500×12000), но категория готова к расширению
-- (other rolled products мостостроительной стали добавятся как sibling L2:
-- balka-mostostroitelnaya, shveller-mostostroitelnyy, ugolok-mostostroitelnyy).
--
-- L1 → L2-with-products pattern (как list-g-k под listovoy-prokat — депth=2).

DO $$
DECLARE
  v_mostovaya_id uuid;
BEGIN
  SELECT id INTO v_mostovaya_id FROM categories WHERE slug = 'mostovaya-stal';
  IF v_mostovaya_id IS NULL THEN
    RAISE EXCEPTION 'Parent category mostovaya-stal (L1) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES (
    'list-mostostroitelnyy',
    'Лист г/к мостостроительный',
    v_mostovaya_id,
    1,
    true
  )
  ON CONFLICT (slug) DO NOTHING;
END $$;

COMMENT ON TABLE categories IS 'W2-18: list-mostostroitelnyy L2 added under mostovaya-stal L1.';

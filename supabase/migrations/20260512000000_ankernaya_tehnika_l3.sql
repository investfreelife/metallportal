-- W2-anchors: 1 L3 категория ankernaya-tehnika под krepezh-gvozdi-bolty-tsepi.
--
-- 12 типов анкеров (анкерный болт, с гайкой, ВСР, клин, Г-образный,
-- с кольцом, с полукольцом, забивной, клиновой, латунный, дюбель-гвоздь,
-- рамный) разносим в ОДНУ L3 категорию вместо 12 L4 — UI routing
-- supports max 3 уровня категорий (см. app/catalog/[c]/[s]/[l3]/[product]).
--
-- Anchor type будет храниться как slug-prefix token (anker-ab-..., anker-ag-...,
-- anker-vsr-..., anker-zab-..., etc.) + опционально в dimensions.anchor_type
-- для filter в UI.
--
-- Pack-variants (1шт/10шт/50шт/100шт/...) хранятся в dimensions.pack_options
-- JSONB как array объектов {qty, article, price_per_piece_rub}.
-- 488 raw rows → ~80 уникальных моделей (тип, диаметр, длина) после dedup.
--
-- 0 миграций products schema требуется — все нестандартные поля
-- (installation_diameter, pack_options) хранятся в существующей JSONB
-- колонке products.dimensions.

DO $$
DECLARE
  v_krepezh_id uuid;
BEGIN
  SELECT id INTO v_krepezh_id FROM categories WHERE slug = 'krepezh-gvozdi-bolty-tsepi';
  IF v_krepezh_id IS NULL THEN
    RAISE EXCEPTION 'Parent category krepezh-gvozdi-bolty-tsepi (L2) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES (
    'ankernaya-tehnika',
    'Анкерная техника',
    v_krepezh_id,
    1,
    true
  )
  ON CONFLICT (slug) DO NOTHING;
END $$;

COMMENT ON TABLE categories IS 'W2-anchors: ankernaya-tehnika L3 added under krepezh-gvozdi-bolty-tsepi (12 anchor types flatten в один L3 — UI routing supports max 3 уровня).';

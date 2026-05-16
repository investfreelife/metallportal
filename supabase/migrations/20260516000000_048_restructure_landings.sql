-- ТЗ #048 — Restructure landings: deactivate izdeliya-iz-metalla + activate kozyrki + INSERT 4 new
--
-- Sergey directive 2026-05-15: «удали лендинг Изделия из металла на заказ! и сделай
-- отдельные лендинги Лестницы, козырьки, антресоли, контейнерные площадки! маф для благоустройства!»
--
-- Per LAW-structure-immutable-only-sergey-changes (2026-05-13): structural changes
-- require explicit Sergey approval. This migration carries that authorization.
--
-- Operations:
--   1. Soft-delete izdeliya-iz-metalla (is_active=false, preserve audit trail)
--   2. DELETE 4 junction rows для izdeliya-iz-metalla (1 primary + 3 related)
--   3. Reactivate kozyrki (already exists, was is_active=false) + bump sort_order 5→11
--   4. INSERT 4 new categories: lestnicy-metallicheskie / antresoli / konteynernye-ploschadki / maf-blagoustroystva
--   5. INSERT 5 primary junctions для new landings (lestnicy/kozyrki/antresoli/konteynernye/maf)
--
-- Parent: gotovye-konstruktsii (id=34e9b14e-48a3-45c8-bab9-4dd516e0e207, display_section=constructions)
-- sort_order range 10-14 для new 5 (под существующими 1-6 actives)

BEGIN;

-- 1. Soft-delete old izdeliya-iz-metalla
UPDATE categories SET is_active = false WHERE slug = 'izdeliya-iz-metalla';

-- 2. Drop its landing junctions (4 rows — 1 primary + 3 related)
DELETE FROM landing_category_links WHERE landing_slug = 'izdeliya-iz-metalla';

-- 3. Reactivate kozyrki (already exists at sort_order=5, is_active=false) and bump to sort_order=11
UPDATE categories
   SET is_active = true,
       sort_order = 11,
       description = 'Металлические козырьки над входом, балконом, окнами — изготовление по индивидуальным размерам, монтаж под ключ.'
 WHERE slug = 'kozyrki';

-- 4. INSERT 4 new categories под gotovye-konstruktsii
INSERT INTO categories (slug, name, description, parent_id, display_section, is_active, sort_order)
VALUES
  ('lestnicy-metallicheskie',
   'Лестницы металлические',
   'Лестницы из металла под ключ — маршевые, винтовые, чердачные. Производство, доставка, монтаж в Москве и МО.',
   '34e9b14e-48a3-45c8-bab9-4dd516e0e207', 'constructions', true, 10),
  ('antresoli',
   'Антресоли',
   'Антресоли (мезонины) — вторые этажи внутри высоких помещений для увеличения полезной площади. Расчёт нагрузки, металлокаркас, монтаж.',
   '34e9b14e-48a3-45c8-bab9-4dd516e0e207', 'constructions', true, 12),
  ('konteynernye-ploschadki',
   'Контейнерные площадки',
   'Контейнерные площадки для размещения мусорных контейнеров — с ограждением, крышей, навесом. Изготовление и монтаж под ключ.',
   '34e9b14e-48a3-45c8-bab9-4dd516e0e207', 'constructions', true, 13),
  ('maf-blagoustroystva',
   'МАФ для благоустройства',
   'Малые архитектурные формы — лавки, урны, велопарковки, ограждения территорий, цветочницы, навесы для остановок.',
   '34e9b14e-48a3-45c8-bab9-4dd516e0e207', 'constructions', true, 14);

-- 5. Primary landing-category junctions для 5 new landings
INSERT INTO landing_category_links (landing_slug, category_id, link_type)
SELECT m.landing_slug, c.id, 'primary'
  FROM categories c
  JOIN (VALUES
    ('lestnicy-metallicheskie',  'lestnicy-metallicheskie'),
    ('kozyrki',                  'kozyrki'),
    ('antresoli',                'antresoli'),
    ('konteynernye-ploschadki',  'konteynernye-ploschadki'),
    ('maf-blagoustroystva',      'maf-blagoustroystva')
  ) AS m(landing_slug, category_slug) ON c.slug = m.category_slug;

COMMIT;

-- Цветмет: 30 L3 form-factors под existing L2.
-- Lessons 080 (pre-allocated slots) + 091 (structure-first) compliant.
-- L1 tsvetnye-metally + 3 L2 (alyuminiy-dyural, med-bronza-latun, olovo-svinets-tsink-nikhrom)
-- уже active в production — не trogаем.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING. Migration уже applied в production
-- (Кирилл #s002 INCIDENT — original timestamp 20260520000000 lost из-за timestamp-collision
-- с Артёмов #i011); этот файл — repo-side recovery, при apply на чистой БД сделает идентичный
-- результат.
--
-- Author: Кирилл (mc-scraper), ТЗ #s002.

DO $$
DECLARE
  v_alu_id  uuid;
  v_med_id  uuid;
BEGIN
  SELECT id INTO v_alu_id FROM categories WHERE slug = 'alyuminiy-dyural';
  SELECT id INTO v_med_id FROM categories WHERE slug = 'med-bronza-latun';

  IF v_alu_id IS NULL OR v_med_id IS NULL THEN
    RAISE EXCEPTION 'Required parent L2 categories missing — abort migration';
  END IF;

  -- 18 L3 под alyuminiy-dyural (общие для алюминия и дюраля; differentiation через products.steel_grade)
  INSERT INTO categories (slug, name, parent_id, sort_order, is_active) VALUES
    ('alyuminiy-krug',           'Круг алюминиевый',                        v_alu_id,  1, true),
    ('alyuminiy-kvadrat',        'Квадрат алюминиевый',                     v_alu_id,  2, true),
    ('alyuminiy-list',           'Лист алюминиевый',                        v_alu_id,  3, true),
    ('alyuminiy-list-riflenyy',  'Лист алюминиевый рифленый',               v_alu_id,  4, true),
    ('alyuminiy-list-pvl',       'Просечно-вытяжной лист алюминиевый',      v_alu_id,  5, true),
    ('alyuminiy-lenta',          'Лента алюминиевая',                       v_alu_id,  6, true),
    ('alyuminiy-truba',          'Труба алюминиевая',                       v_alu_id,  7, true),
    ('alyuminiy-plita',          'Плита алюминиевая',                       v_alu_id,  8, true),
    ('alyuminiy-profil-stroy',   'Общестроительный профиль алюминиевый',    v_alu_id,  9, true),
    ('alyuminiy-profil-vent',    'Вентиляционный профиль алюминиевый',      v_alu_id, 10, true),
    ('alyuminiy-ugolok',         'Уголок алюминиевый',                      v_alu_id, 11, true),
    ('alyuminiy-shveller',       'Швеллер алюминиевый',                     v_alu_id, 12, true),
    ('alyuminiy-shestigrannik',  'Шестигранник алюминиевый',                v_alu_id, 13, true),
    ('alyuminiy-shina',          'Шина алюминиевая',                        v_alu_id, 14, true),
    ('alyuminiy-tavr',           'Тавр алюминиевый',                        v_alu_id, 15, true),
    ('alyuminiy-provoloka',      'Проволока алюминиевая',                   v_alu_id, 16, true),
    ('alyuminiy-folga',          'Фольга алюминиевая',                      v_alu_id, 17, true),
    ('alyuminiy-chushka',        'Чушка алюминиевая',                       v_alu_id, 18, true)
  ON CONFLICT (slug) DO NOTHING;

  -- 12 L3 под med-bronza-latun
  INSERT INTO categories (slug, name, parent_id, sort_order, is_active) VALUES
    ('med-krug',             'Круг медный',           v_med_id,  1, true),
    ('med-list',             'Лист медный',           v_med_id,  2, true),
    ('med-lenta',            'Лента медная',          v_med_id,  3, true),
    ('med-truba',            'Труба медная',          v_med_id,  4, true),
    ('med-shina',            'Шина медная',           v_med_id,  5, true),
    ('latun-krug',           'Круг латунный',         v_med_id,  6, true),
    ('latun-kvadrat',        'Квадрат латунный',      v_med_id,  7, true),
    ('latun-list',           'Лист латунный',         v_med_id,  8, true),
    ('latun-lenta',          'Лента латунная',        v_med_id,  9, true),
    ('latun-truba',          'Труба латунная',        v_med_id, 10, true),
    ('latun-shestigrannik',  'Шестигранник латунный', v_med_id, 11, true),
    ('bronza-krug',          'Круг бронзовый',        v_med_id, 12, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Под olovo-svinets-tsink-nikhrom: ничего не добавляем.
  -- 9 нихромовых articles из источника совпадают 1:1 с existing 9 products в
  -- metizy → provoloka-kanaty → provoloka-nikhromovaya (pre-flight Q5 SQL подтвердил
  -- 100% slug overlap по size+mark). Они идут через reconcile (metadataConflicts на
  -- dimensions field — POLICY: no auto-update existing data).
END $$;

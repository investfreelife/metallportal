-- =============================================
-- Full category tree — all 3 levels
-- ON CONFLICT (slug) DO NOTHING — safe to re-run
-- =============================================

-- LEVEL 1: Main sections (update existing names if needed)
INSERT INTO categories (name, slug, description, icon, sort_order, is_active)
VALUES
  ('Металлопрокат',           'metalloprokat',  'Трубы, арматура, листы, балки, уголки и другой металлопрокат', '🔩', 1, true),
  ('Металлоконструкции',      'konstruktsii',   'Ангары, склады, навесы, каркасы зданий',                      '🏗️', 2, true),
  ('Заборы и ограждения',     'zabory',         'Профнастил, сетка, ворота, калитки, рабица',                  '🚧', 3, true),
  ('Быстровозводимые здания', 'zdaniya',        'Модульные здания, склады, ангары, павильоны',                 '🏪', 4, true),
  ('Изделия на заказ',        'zakaz',          'Индивидуальные металлоконструкции по чертежам',               '⚙️', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 2: Under Металлопрокат
-- =============================================
INSERT INTO categories (name, slug, description, icon, parent_id, sort_order, is_active)
VALUES
  ('Трубы и профиль',       'truby-i-profil',   'Профильные, круглые, водогазопроводные трубы',                '🔧', (SELECT id FROM categories WHERE slug='metalloprokat'), 1,  true),
  ('Арматура и сетка',      'armatura-i-setka',  'Арматура А500С, кладочная и дорожная сетка',                 '⚙️', (SELECT id FROM categories WHERE slug='metalloprokat'), 2,  true),
  ('Листовой прокат',       'listovoj-prokat',   'Горячекатаный, холоднокатаный, оцинкованный лист',           '📄', (SELECT id FROM categories WHERE slug='metalloprokat'), 3,  true),
  ('Фасонный прокат',       'fasonnyj-prokat',   'Уголки, швеллеры, балки, зетовые профили',                   '📐', (SELECT id FROM categories WHERE slug='metalloprokat'), 4,  true),
  ('Сортовой прокат',       'sortovoj-prokat',   'Круг, квадрат, полоса, шестигранник',                        '🔘', (SELECT id FROM categories WHERE slug='metalloprokat'), 5,  true),
  ('Профнастил',            'profnastil',         'Профнастил окрашенный и оцинкованный, сэндвич-панели',       '🏠', (SELECT id FROM categories WHERE slug='metalloprokat'), 6,  true),
  ('Нержавеющий металл',    'nerzhaveika',        'Лист, труба, круг, проволока нержавеющие',                   '✨', (SELECT id FROM categories WHERE slug='metalloprokat'), 7,  true),
  ('Цветной металл',        'cvetnoj-metall',     'Алюминий, медь, латунь, бронза, титан',                      '🟡', (SELECT id FROM categories WHERE slug='metalloprokat'), 8,  true),
  ('Метизы и крепёж',       'metizy-krepezh',     'Анкеры, болты, гайки, шпильки, саморезы',                    '🔩', (SELECT id FROM categories WHERE slug='metalloprokat'), 9,  true),
  ('Качественный прокат',   'kachestvennyj',      'Конструкционная, легированная, инструментальная сталь',       '💎', (SELECT id FROM categories WHERE slug='metalloprokat'), 10, true),
  ('Инженерные системы',    'inzhenernye',        'Фланцы, краны, задвижки, фитинги',                           '🔧', (SELECT id FROM categories WHERE slug='metalloprokat'), 11, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 2: Under Металлоконструкции
-- =============================================
INSERT INTO categories (name, slug, description, icon, parent_id, sort_order, is_active)
VALUES
  ('Ангары и склады',          'angary',       'Быстровозводимые ангары и складские помещения',  '🏭', (SELECT id FROM categories WHERE slug='konstruktsii'), 1, true),
  ('Каркасы зданий',           'karkasy',      'Металлические каркасы для зданий и сооружений',  '🏗️', (SELECT id FROM categories WHERE slug='konstruktsii'), 2, true),
  ('Навесы и козырьки',        'navesy',       'Металлические навесы, козырьки, перголы',         '☂️', (SELECT id FROM categories WHERE slug='konstruktsii'), 3, true),
  ('Металлические лестницы',   'lestnicy',     'Лестницы, площадки, ограждения',                  '🪜', (SELECT id FROM categories WHERE slug='konstruktsii'), 4, true),
  ('Ворота промышленные',      'vorota-prom',  'Промышленные откатные и секционные ворота',       '🚪', (SELECT id FROM categories WHERE slug='konstruktsii'), 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 2: Under Заборы и ограждения
-- =============================================
INSERT INTO categories (name, slug, description, icon, parent_id, sort_order, is_active)
VALUES
  ('Заборы из профнастила',      'zab-prof',        'Заборы и ограждения из профлиста',              '🏗️', (SELECT id FROM categories WHERE slug='zabory'), 1, true),
  ('Сетчатые заборы',            'zab-setka',       'Заборы из сварной и плетёной сетки',            '🔲', (SELECT id FROM categories WHERE slug='zabory'), 2, true),
  ('Ворота и калитки',           'vorota-kalitki',  'Распашные, откатные ворота и калитки',          '🚪', (SELECT id FROM categories WHERE slug='zabory'), 3, true),
  ('Штакетник металлический',    'shtaketnik',      'Евроштакетник для заборов',                     '🪵', (SELECT id FROM categories WHERE slug='zabory'), 4, true),
  ('Рабица',                     'rabica',          'Сетка рабица оцинкованная и в ПВХ',             '🕸️', (SELECT id FROM categories WHERE slug='zabory'), 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 2: Under Быстровозводимые здания
-- =============================================
INSERT INTO categories (name, slug, description, icon, parent_id, sort_order, is_active)
VALUES
  ('Склады и цеха',            'sklady-ceha',  'Быстровозводимые склады и производственные цеха', '🏭', (SELECT id FROM categories WHERE slug='zdaniya'), 1, true),
  ('Торговые павильоны',       'paviljony',    'Торговые павильоны и магазины',                    '🏪', (SELECT id FROM categories WHERE slug='zdaniya'), 2, true),
  ('Вахтовые посёлки',         'vahtovye',     'Модульные вахтовые городки',                      '🏘️', (SELECT id FROM categories WHERE slug='zdaniya'), 3, true),
  ('Холодильные камеры',       'holodilnye',   'Холодильные и морозильные камеры',                '❄️', (SELECT id FROM categories WHERE slug='zdaniya'), 4, true),
  ('Гаражи металлические',    'garazhi',      'Металлические гаражи и боксы',                    '🅿️', (SELECT id FROM categories WHERE slug='zdaniya'), 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 2: Under Изделия на заказ
-- =============================================
INSERT INTO categories (name, slug, description, icon, parent_id, sort_order, is_active)
VALUES
  ('Нестандартные конструкции', 'nestand',      'Металлоконструкции по индивидуальным проектам',  '🔧', (SELECT id FROM categories WHERE slug='zakaz'), 1, true),
  ('Металлообработка',         'metalloobr',   'Токарные, фрезерные работы',                     '🛠️', (SELECT id FROM categories WHERE slug='zakaz'), 2, true),
  ('Лазерная резка',           'lazernaya',    'Лазерная резка листового металла',                '⚡', (SELECT id FROM categories WHERE slug='zakaz'), 3, true),
  ('Гибка металла',            'gibka',        'Гибка листов и профилей',                         '↩️', (SELECT id FROM categories WHERE slug='zakaz'), 4, true),
  ('Сварочные работы',         'svarka',       'Профессиональные сварочные работы',                '🔥', (SELECT id FROM categories WHERE slug='zakaz'), 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Трубы и профиль
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Трубы водогазопроводные ВГП',  'truby-vgp',          'Трубы ВГП ГОСТ 3262-75',                    (SELECT id FROM categories WHERE slug='truby-i-profil'), 1, true),
  ('Трубы профильные квадратные',  'truby-profilnye',    'Квадратные и прямоугольные профильные трубы',(SELECT id FROM categories WHERE slug='truby-i-profil'), 2, true),
  ('Трубы электросварные',         'truby-es',           'Электросварные трубы ГОСТ 10704-91',         (SELECT id FROM categories WHERE slug='truby-i-profil'), 3, true),
  ('Трубы бесшовные',              'truby-besshovnye',   'Бесшовные горячедеформированные трубы',      (SELECT id FROM categories WHERE slug='truby-i-profil'), 4, true),
  ('Трубы оцинкованные',           'truby-ocinkovanye',  'Оцинкованные трубы круглые и профильные',    (SELECT id FROM categories WHERE slug='truby-i-profil'), 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Арматура и сетка
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Арматура А500С',    'armatura-a500',      'Арматура класса А500С ГОСТ 34028-2016',           (SELECT id FROM categories WHERE slug='armatura-i-setka'), 1, true),
  ('Арматура А240',     'armatura-a240',      'Арматура гладкая класса А240',                    (SELECT id FROM categories WHERE slug='armatura-i-setka'), 2, true),
  ('Сетка сварная',     'setka-svarnaya',     'Сетка сварная из проволоки ВР-1',                 (SELECT id FROM categories WHERE slug='armatura-i-setka'), 3, true),
  ('Сетка кладочная',   'setka-kladochnaya',  'Сетка кладочная для строительства',               (SELECT id FROM categories WHERE slug='armatura-i-setka'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Листовой прокат
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Лист горячекатаный',   'list-gk',         'Лист г/к ГОСТ 19903-2015',           (SELECT id FROM categories WHERE slug='listovoj-prokat'), 1, true),
  ('Лист холоднокатаный',  'list-hk',         'Лист х/к ГОСТ 19904-90',             (SELECT id FROM categories WHERE slug='listovoj-prokat'), 2, true),
  ('Лист оцинкованный',    'list-ocink',      'Лист оцинкованный ГОСТ 14918-2020',  (SELECT id FROM categories WHERE slug='listovoj-prokat'), 3, true),
  ('Лист нержавеющий',     'list-nerzh',      'Лист нержавеющий AISI 304/316',      (SELECT id FROM categories WHERE slug='listovoj-prokat'), 4, true),
  ('Лист рифлёный',        'list-riflyonyj',  'Лист стальной рифлёный ГОСТ 8568-77',(SELECT id FROM categories WHERE slug='listovoj-prokat'), 5, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Фасонный прокат
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Уголок стальной',       'ugolok',    'Уголок равнополочный и неравнополочный',  (SELECT id FROM categories WHERE slug='fasonnyj-prokat'), 1, true),
  ('Швеллер',               'shveller',  'Швеллер горячекатаный ГОСТ 8240-97',     (SELECT id FROM categories WHERE slug='fasonnyj-prokat'), 2, true),
  ('Балка двутавровая',     'balka',     'Двутавровая балка ГОСТ 26020-83',        (SELECT id FROM categories WHERE slug='fasonnyj-prokat'), 3, true),
  ('Зетовый профиль',       'zetovyj',   'Z-образный профиль',                     (SELECT id FROM categories WHERE slug='fasonnyj-prokat'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Сортовой прокат
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Круг стальной',      'krug-stalnoj',     'Круг горячекатаный и калиброванный',  (SELECT id FROM categories WHERE slug='sortovoj-prokat'), 1, true),
  ('Квадрат стальной',   'kvadrat-stalnoj',  'Квадрат стальной горячекатаный',      (SELECT id FROM categories WHERE slug='sortovoj-prokat'), 2, true),
  ('Полоса стальная',    'polosa-stalnaya',  'Полоса г/к ГОСТ 103-2006',            (SELECT id FROM categories WHERE slug='sortovoj-prokat'), 3, true),
  ('Шестигранник',       'shestigrannik',    'Шестигранник стальной калиброванный',  (SELECT id FROM categories WHERE slug='sortovoj-prokat'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Профнастил
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Профнастил окрашенный',          'prof-okrash',   'Профнастил с полимерным покрытием',       (SELECT id FROM categories WHERE slug='profnastil'), 1, true),
  ('Профнастил оцинкованный',        'prof-ocink',    'Профнастил оцинкованный без покраски',    (SELECT id FROM categories WHERE slug='profnastil'), 2, true),
  ('Сэндвич-панели стеновые',        'sendvich-st',   'Стеновые сэндвич-панели с утеплителем',   (SELECT id FROM categories WHERE slug='profnastil'), 3, true),
  ('Сэндвич-панели кровельные',      'sendvich-kr',   'Кровельные сэндвич-панели',               (SELECT id FROM categories WHERE slug='profnastil'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Нержавеющий металл
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Лист нержавеющий',       'nerzh-list',      'Лист нержавеющий AISI 304/316/321',            (SELECT id FROM categories WHERE slug='nerzhaveika'), 1, true),
  ('Труба нержавеющая',      'nerzh-truba',     'Труба нержавеющая бесшовная и сварная',         (SELECT id FROM categories WHERE slug='nerzhaveika'), 2, true),
  ('Круг нержавеющий',       'nerzh-krug',      'Круг нержавеющий горячекатаный',                (SELECT id FROM categories WHERE slug='nerzhaveika'), 3, true),
  ('Проволока нержавеющая',  'nerzh-provoloka', 'Проволока из нержавеющей стали',                (SELECT id FROM categories WHERE slug='nerzhaveika'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Цветной металл
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Алюминиевый прокат', 'alyuminij',  'Лист, труба, профиль алюминиевый',   (SELECT id FROM categories WHERE slug='cvetnoj-metall'), 1, true),
  ('Медь и латунь',      'med-latun',  'Лист, труба, прут медный и латунный', (SELECT id FROM categories WHERE slug='cvetnoj-metall'), 2, true),
  ('Бронза',             'bronza',     'Бронзовый прокат',                    (SELECT id FROM categories WHERE slug='cvetnoj-metall'), 3, true),
  ('Титановый прокат',   'titan',      'Титановый лист, пруток, труба',       (SELECT id FROM categories WHERE slug='cvetnoj-metall'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Метизы и крепёж
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Анкерная техника',      'ankery',       'Анкерные болты и крепёж',             (SELECT id FROM categories WHERE slug='metizy-krepezh'), 1, true),
  ('Болты и гайки',         'bolty-gajki',  'Болты, гайки, шайбы',                 (SELECT id FROM categories WHERE slug='metizy-krepezh'), 2, true),
  ('Шпильки резьбовые',     'shpilki',      'Шпильки резьбовые DIN 975/976',       (SELECT id FROM categories WHERE slug='metizy-krepezh'), 3, true),
  ('Саморезы и шурупы',     'samorezy',     'Кровельные саморезы и шурупы',         (SELECT id FROM categories WHERE slug='metizy-krepezh'), 4, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Качественный прокат
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Круг конструкционный',    'krug-konstr',     'Круг из конструкционной стали',        (SELECT id FROM categories WHERE slug='kachestvennyj'), 1, true),
  ('Легированная сталь',      'legirovannaya',   'Прокат из легированной стали',          (SELECT id FROM categories WHERE slug='kachestvennyj'), 2, true),
  ('Инструментальная сталь',  'instrument',      'Прокат из инструментальной стали',      (SELECT id FROM categories WHERE slug='kachestvennyj'), 3, true)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- LEVEL 3: Under Инженерные системы
-- =============================================
INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
VALUES
  ('Фланцы стальные',    'flancy',   'Фланцы плоские и воротниковые',   (SELECT id FROM categories WHERE slug='inzhenernye'), 1, true),
  ('Краны шаровые',       'krany',    'Краны шаровые стальные',           (SELECT id FROM categories WHERE slug='inzhenernye'), 2, true),
  ('Задвижки',            'zadvizhki','Задвижки клиновые стальные',       (SELECT id FROM categories WHERE slug='inzhenernye'), 3, true),
  ('Фитинги стальные',   'fitingi',  'Фитинги резьбовые и приварные',    (SELECT id FROM categories WHERE slug='inzhenernye'), 4, true)
ON CONFLICT (slug) DO NOTHING;

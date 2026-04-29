-- ============================================================================
-- Migration: 20260508000100_products_metallprokat_truncate.sql
-- Phase 0 / Week 2 — ТЗ #18 Шаг 3: бэкап + DELETE металлопрокат
--
-- Источник: week2/CATEGORIES_CLASSIFICATION.md (79 категорий, 3675 products)
-- Применять ПОСЛЕ 20260508000000_products_catalog_fields.sql
-- ============================================================================

BEGIN;

-- ── 0. Список категорий металлопрокат (из CATEGORIES_CLASSIFICATION.md) ─────

CREATE TEMPORARY TABLE temp_metallprokat_categories(name text) ON COMMIT DROP;
INSERT INTO temp_metallprokat_categories VALUES
    ('Трубы нержавеющие'),
    ('Лист нержавеющий'),
    ('Круг, квадрат, шестигранник'),
    ('Трубы х/д'),
    ('Трубы г/д'),
    ('Труба профильная'),
    ('Лист г/к'),
    ('Электросварные трубы'),
    ('Швеллер'),
    ('Уголок'),
    ('Двутавр'),
    ('Полоса г/к'),
    ('ТРУБЫ СТАЛЬНЫЕ'),
    ('Лист оцинкованный'),
    ('Арматура'),
    ('Лист х/к'),
    ('Круг стальной'),
    ('Труба оцинкованная'),
    ('Просечно-вытяжной лист (ПВЛ)'),
    ('Лист рифленый'),
    ('Квадрат горячекатаный'),
    ('СОРТОВОЙ ПРОКАТ'),
    ('ДЕТАЛИ ТРУБОПРОВОДОВ'),
    ('Хомуты'),
    ('Краны шаровые стальные'),
    ('Грязевики'),
    ('ЗАПОРНАЯ АРМАТУРА'),
    ('ФАСОННЫЙ ПРОКАТ'),
    ('ЛИСТОВОЙ ПРОКАТ'),
    ('НЕРЖАВЕЮЩИЙ ПРОКАТ'),
    ('Перфорированный стальной лист'),
    ('Рулон г/к'),
    ('Трубопроводная арматура'),
    ('Трубы электросварные низколегированные'),
    ('Котельные трубы'),
    ('Лист г/к 14ХГНДЦ'),
    ('Лист г/к травленый А606'),
    ('Лист х/к А606 Grade 45'),
    ('Проволока 14ХГНДЦ'),
    ('Сортовой прокат 14ХГНДЦ'),
    ('Труба 14ХГНДЦ'),
    ('Швеллер и уголок 14ХГНДЦ'),
    ('Детали трубопровода'),
    ('Нержавеющие трубы'),
    ('Полоса, уголок'),
    ('Проволока нержавеющая'),
    ('Сварочные материалы'),
    ('Рулоны нержавеющие'),
    ('Круг оцинкованный'),
    ('Перфорированный оцинкованный лист'),
    ('Полоса оцинкованная г/к'),
    ('Колючая проволока КУ-1/КЦП-1'),
    ('Спиральный барьер СББ АКЛ'),
    ('Спиральный барьер СББ АСКЛ'),
    ('Лист нитрид титана'),
    ('Заглушки стальные'),
    ('Задвижки стальные'),
    ('Задвижки чугунные'),
    ('Отводы стальные'),
    ('Клапаны обратные'),
    ('Проволока, канаты'),
    ('Переходы стальные'),
    ('Клапаны чугунные'),
    ('Бакелит листовой'),
    ('Сгоны, бочата, резьбы'),
    ('Клапаны пожарные'),
    ('ЭЛЕКТРОСВАРНЫЕ ФИТИНГИ'),
    ('ОЦИНКОВАННЫЙ ПРОКАТ'),
    ('Тройники стальные'),
    ('Клапаны стальные запорные'),
    ('Fox Fittings'),
    ('Фильтры'),
    ('Краны латунные для манометров'),
    ('Georg Fischer'),
    ('Фланцы стальные'),
    ('Краны шаровые латунные'),
    ('АРМАТУРНЫЙ ПРОКАТ'),
    ('Титановый прокат');

-- NB: «Лист нержавеющий» дублируется в исходнике (ЛИСТОВОЙ ПРОКАТ и НЕРЖАВЕЮЩИЙ ПРОКАТ)
-- Дубль безвреден: temp-таблица просто содержит два одинаковых имени, IN фильтрует по уникальности.

-- ── 1. Бэкап удаляемых products ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products_archive_metallprokat_20260428 AS
  SELECT p.*
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE c.name IN (SELECT name FROM temp_metallprokat_categories);

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM products_archive_metallprokat_20260428;
  RAISE NOTICE 'Забэкаплено products: %', cnt;
  IF cnt = 0 THEN
    RAISE EXCEPTION 'СТОП: Бэкап пустой — проверьте список категорий. Миграция откатана.';
  END IF;
END $$;

-- ── 2. Бэкап категорий ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories_archive_metallprokat_20260428 AS
  SELECT *
  FROM categories
  WHERE name IN (SELECT name FROM temp_metallprokat_categories);

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM categories_archive_metallprokat_20260428;
  RAISE NOTICE 'Забэкаплено categories: %', cnt;
END $$;

-- ── 3. Обнуляем matched_* в supplier_price_offers ──────────────────────────

UPDATE supplier_price_offers
SET
  matched_product_id = NULL,
  match_status       = NULL,
  match_score        = NULL,
  matched_at         = NULL
WHERE matched_product_id IN (
  SELECT id FROM products_archive_metallprokat_20260428
);

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM supplier_price_offers
  WHERE matched_product_id IS NOT NULL;
  RAISE NOTICE 'После обнуления: matched_product_id IS NOT NULL = %', cnt;
END $$;

-- ── 4. DELETE из products ───────────────────────────────────────────────────

DELETE FROM products
WHERE id IN (
  SELECT id FROM products_archive_metallprokat_20260428
);

DO $$
DECLARE after_cnt int; archive_cnt int;
BEGIN
  SELECT count(*) INTO after_cnt  FROM products;
  SELECT count(*) INTO archive_cnt FROM products_archive_metallprokat_20260428;
  RAISE NOTICE 'Products после DELETE: % (удалено ~%)', after_cnt, archive_cnt;
END $$;

-- ── 5. DELETE пустых категорий ──────────────────────────────────────────────

DELETE FROM categories
WHERE name IN (SELECT name FROM temp_metallprokat_categories)
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.category_id = categories.id
  );

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM categories;
  RAISE NOTICE 'Categories после DELETE: %', cnt;
END $$;

-- ── 6. Итоговая проверка ────────────────────────────────────────────────────

DO $$
DECLARE
  prod_left         int;
  archive_size      int;
  matched_remaining int;
  offers_total      int;
BEGIN
  SELECT count(*) INTO prod_left         FROM products;
  SELECT count(*) INTO archive_size      FROM products_archive_metallprokat_20260428;
  SELECT count(*) INTO matched_remaining FROM supplier_price_offers WHERE matched_product_id IS NOT NULL;
  SELECT count(*) INTO offers_total      FROM supplier_price_offers;

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'ИТОГ:';
  RAISE NOTICE '  products осталось:        %', prod_left;
  RAISE NOTICE '  в архиве (удалено):       %', archive_size;
  RAISE NOTICE '  offers с match (должно=0):%', matched_remaining;
  RAISE NOTICE '  offers всего (б/з):       %', offers_total;
  RAISE NOTICE '══════════════════════════════════════════';

  IF matched_remaining > 0 THEN
    RAISE WARNING 'matched_product_id IS NOT NULL = % — проверить вручную!', matched_remaining;
  END IF;
END $$;

COMMIT;

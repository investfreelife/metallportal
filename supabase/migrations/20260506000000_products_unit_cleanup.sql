-- ══════════════════════════════════════════════════════════════════
-- Migration: products unit cleanup
-- Задача: убрать мусорные unit (ГОСТ XXXX-XX и подобные), нормализовать.
-- ══════════════════════════════════════════════════════════════════

-- 1. Сохраняем мусорные unit как audit-таблицу (на всякий случай)
CREATE TABLE IF NOT EXISTS products_unit_cleanup_log AS
SELECT id, unit AS old_unit, now() AS cleaned_at
FROM products
WHERE unit ~ '^ГОСТ' OR unit ~ '^\d{4}-\d{2,4}$' OR length(unit) > 10;

-- 2. Чистим (unit is NOT NULL DEFAULT 'т' — ставим дефолт)
UPDATE products SET unit = 'т'
WHERE unit ~ '^ГОСТ' OR unit ~ '^\d{4}-\d{2,4}$' OR length(unit) > 10;

-- 3. Нормализуем оставшиеся
UPDATE products SET unit = 'м²' WHERE unit IN ('м2', 'кв.м', 'кв м');
UPDATE products SET unit = 'м'  WHERE unit IN ('м.п.', 'м.п', 'пог.м', 'пог. м');
UPDATE products SET unit = 'т'  WHERE unit IN ('тн', 'тонн', 'тонна');

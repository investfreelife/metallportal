-- ============================================================
-- ИСПРАВЛЕНИЕ ТАБЛИЦЫ ORDERS — выполнить в Supabase SQL Editor
-- ============================================================

-- Создать orders если нет
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name    TEXT,
  customer_phone   TEXT,
  customer_email   TEXT,
  comment          TEXT,
  items            JSONB DEFAULT '[]',
  status           TEXT DEFAULT 'new',
  total_amount     NUMERIC(14, 2),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Добавить недостающие колонки (если таблица уже существовала)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items         JSONB    DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount  NUMERIC  DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment       TEXT;

-- RLS — разрешить сервисному ключу всё
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_orders" ON orders;
CREATE POLICY "service_role_all_orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Убедиться что deals.items существует
ALTER TABLE deals ADD COLUMN IF NOT EXISTS items     JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency  TEXT  DEFAULT 'RUB';

-- Убедиться что deals доступны для записи
DROP POLICY IF EXISTS "service_role_all" ON deals;
CREATE POLICY "service_role_all" ON deals
  FOR ALL USING (true) WITH CHECK (true);

-- Проверка
SELECT
  column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('orders', 'deals')
  AND table_schema = 'public'
ORDER BY table_name, column_name;

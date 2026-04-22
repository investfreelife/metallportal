-- ============================================================
-- PIPELINE: задачи менеджеру + поставщики + стадии металла
-- Выполнить в Supabase SQL Editor
-- ============================================================

-- 1. Таблица задач менеджеру
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  deal_id     UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  status      TEXT DEFAULT 'pending',   -- pending | done
  priority    TEXT DEFAULT 'normal',    -- urgent | high | normal | low
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  done_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON tasks;
CREATE POLICY "service_role_all" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- 2. Расширить deals: поставщики + флаги
ALTER TABLE deals ADD COLUMN IF NOT EXISTS suppliers          JSONB    DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_notified  BOOLEAN  DEFAULT false;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS items             JSONB    DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency          TEXT     DEFAULT 'RUB';

-- 3. Обновить CHECK на stage (добавить стадии металла)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check CHECK (stage IN (
  'new',              -- Новая заявка
  'call',             -- Связались с клиентом
  'supplier_request', -- Запрос поставщикам
  'proposal',         -- КП отправлено
  'negotiation',      -- Переговоры
  'won',              -- Оплата
  'delivery',         -- Доставка
  'completed',        -- Завершено
  'lost',             -- Отказ
  -- Обратная совместимость
  'qualified', 'sent'
));

-- 4. RLS для deals
DROP POLICY IF EXISTS "service_role_all" ON deals;
CREATE POLICY "service_role_all" ON deals FOR ALL USING (true) WITH CHECK (true);

-- Проверка
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'deals' AND table_schema = 'public'
ORDER BY column_name;

-- Event-driven webhooks: Supabase → harlan-ai
-- Триггеры вызывают AI только при реальных событиях (новый контакт, закрытая сделка, одобренная задача)

-- Убедиться что таблица ai_cost_log существует (на случай если предыдущая миграция не выполнена)
CREATE TABLE IF NOT EXISTS ai_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  agent_name TEXT NOT NULL,
  task_name TEXT NOT NULL,
  model TEXT NOT NULL,
  model_short TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  input_cost_usd DECIMAL(10,6) DEFAULT 0,
  output_cost_usd DECIMAL(10,6) DEFAULT 0,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER,
  contact_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_cost_log' AND policyname = 'tenant_cost'
  ) THEN
    ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "tenant_cost" ON ai_cost_log FOR ALL USING (tenant_id = get_tenant_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cost_log ON ai_cost_log(tenant_id, created_at DESC);

-- ─── WEBHOOK 1: Новый контакт → скорировать ───────────────

CREATE OR REPLACE FUNCTION notify_contact_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ai_score IS NULL THEN
    PERFORM net.http_post(
      url     := current_setting('app.ai_url', true) || '/api/webhook/contact-created',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', current_setting('app.ai_key', true)
      ),
      body    := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END $$;

-- ─── WEBHOOK 2: Сделка закрыта → уведомить ────────────────

CREATE OR REPLACE FUNCTION notify_deal_won()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage = 'won' AND (OLD.stage IS NULL OR OLD.stage != 'won') THEN
    PERFORM net.http_post(
      url     := current_setting('app.ai_url', true) || '/api/webhook/deal-won',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', current_setting('app.ai_key', true)
      ),
      body    := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END $$;

-- ─── WEBHOOK 3: Задача одобрена → выполнить ───────────────

CREATE OR REPLACE FUNCTION notify_task_approved()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    PERFORM net.http_post(
      url     := current_setting('app.ai_url', true) || '/api/webhook/task-approved',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key', current_setting('app.ai_key', true)
      ),
      body    := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END $$;

-- ─── Настройки URL (заменить на реальный Railway URL) ─────

ALTER DATABASE postgres SET app.ai_url = 'https://harlan-ai-production-production.up.railway.app';
ALTER DATABASE postgres SET app.ai_key = 'harlan_steel_ai_2024_secret_key_xK9mP3nQ';

-- ─── Триггеры ─────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_contact_created ON contacts;
CREATE TRIGGER trg_contact_created
  AFTER INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION notify_contact_created();

DROP TRIGGER IF EXISTS trg_deal_won ON deals;
CREATE TRIGGER trg_deal_won
  AFTER UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION notify_deal_won();

DROP TRIGGER IF EXISTS trg_task_approved ON ai_queue;
CREATE TRIGGER trg_task_approved
  AFTER UPDATE ON ai_queue
  FOR EACH ROW EXECUTE FUNCTION notify_task_approved();

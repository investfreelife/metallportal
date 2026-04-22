-- ============================================================
-- ВЫПОЛНИТЬ В SUPABASE SQL EDITOR
-- https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- 1. СОЗДАТЬ tenant_settings (если нет)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON tenant_settings;
CREATE POLICY "service_only" ON tenant_settings USING (false);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- 2. РАСШИРИТЬ ai_queue (колонки + CHECK constraints)
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS suggested_message TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS auto_execute_at TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_action_type_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_action_type_check
  CHECK (action_type IN (
    'send_email', 'send_message', 'make_call', 'call',
    'send_proposal', 'create_task', 'update_stage',
    'send_campaign', 'schedule'
  ));

ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_priority_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_priority_check
  CHECK (priority IN ('urgent', 'high', 'medium', 'normal', 'low'));

ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_status_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_status_check
  CHECK (status IN (
    'pending', 'approved', 'rejected', 'executed',
    'auto_executed', 'snoozed'
  ));

-- 3. РАСШИРИТЬ contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_segment TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_next_action TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_tg_chat ON contacts(telegram_chat_id);

-- 3b. SYSTEM LOGS для AI-мониторинга
CREATE TABLE IF NOT EXISTS system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  ts          TIMESTAMPTZ DEFAULT now(),
  level       TEXT DEFAULT 'info',   -- info | warn | error
  event       TEXT NOT NULL,         -- webhook_received | tg_notify_sent | ai_queue_created | etc
  status      TEXT DEFAULT 'ok',     -- ok | failed
  detail      JSONB DEFAULT '{}',
  error_msg   TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_logs_ts ON system_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_event ON system_logs(event);
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_logs" ON system_logs USING (true) WITH CHECK (true);

-- 4. РАСШИРИТЬ activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS body TEXT;

-- 5. РАСШИРИТЬ admin_users (invite flow + telegram)
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_admin_users_invite_token ON admin_users(invite_token);

-- 6. СНЯТЬ RLS с site_events чтобы сервисный ключ писал без проблем
-- (уже есть policy, но добавим явную для service role)
DROP POLICY IF EXISTS "service_role_all" ON site_events;
CREATE POLICY "service_role_all" ON site_events
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON contacts;
CREATE POLICY "service_role_all" ON contacts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON activities;
CREATE POLICY "service_role_all" ON activities
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON ai_queue;
CREATE POLICY "service_role_all" ON ai_queue
  FOR ALL USING (true) WITH CHECK (true);

-- 7. РАСШИРИТЬ deals — добавить items (JSONB массив товаров)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RUB';

DROP POLICY IF EXISTS "service_role_all" ON deals;
CREATE POLICY "service_role_all" ON deals
  FOR ALL USING (true) WITH CHECK (true);

-- 8. ПРОВЕРКА — должны показать таблицы
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

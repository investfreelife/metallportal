-- ============================================================
-- ▶ ЗАПУСТИТЬ ЭТОТ ФАЙЛ В SUPABASE SQL EDITOR
-- Supabase Dashboard → SQL Editor → New Query → Run
-- Включает всё: схему, колонки, RLS, задачи, поставщики
-- ============================================================

-- ── ТАБЛИЦА ORDERS ─────────────────────────────────────────
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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items         JSONB    DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount  NUMERIC  DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment       TEXT;

-- ── ТАБЛИЦА ЗАДАЧ МЕНЕДЖЕРУ ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  deal_id     UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  status      TEXT DEFAULT 'pending',
  priority    TEXT DEFAULT 'normal',
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  done_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_deal   ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ── РАСШИРИТЬ DEALS ─────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS items              JSONB   DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency           TEXT    DEFAULT 'RUB';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS suppliers          JSONB   DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_notified  BOOLEAN DEFAULT false;

-- Стадии воронки металла
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check CHECK (stage IN (
  'new', 'call', 'supplier_request', 'proposal',
  'negotiation', 'won', 'delivery', 'completed', 'lost',
  'qualified', 'sent'
));

-- ── РАСШИРИТЬ CONTACTS ──────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS visitor_id          TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_seen_at        TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_segment          TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_next_action      TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source              TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type                TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telegram_chat_id    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_otp           TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_otp_expires_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_at     TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_phone  ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_tg     ON contacts(telegram_chat_id);

-- ── CONTACT SESSIONS (личный кабинет) ───────────────────────
CREATE TABLE IF NOT EXISTS contact_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  token      TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_sessions_token ON contact_sessions(token);

-- ── TENANT SETTINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- ── SYSTEM LOGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  ts        TIMESTAMPTZ DEFAULT now(),
  level     TEXT DEFAULT 'info',
  event     TEXT NOT NULL,
  status    TEXT DEFAULT 'ok',
  detail    JSONB DEFAULT '{}',
  error_msg TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_logs_ts    ON system_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_event ON system_logs(event);

-- ── РАСШИРИТЬ AI_QUEUE ───────────────────────────────────────
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS suggested_message TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS subject           TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS snoozed_until     TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS auto_execute_at   TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS content           TEXT;

-- ── РАСШИРИТЬ ACTIVITIES ─────────────────────────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata  JSONB DEFAULT '{}';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS subject   TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS body      TEXT;

-- ── РАСШИРИТЬ ADMIN_USERS ────────────────────────────────────
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_token       TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_expires_at  TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_username  TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_chat_id   TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_admin_users_invite ON admin_users(invite_token);

-- ── ИНДЕКСЫ ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_phone   ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- RLS — БЕЗОПАСНОСТЬ (включить на всех таблицах)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_queue         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;

-- Политики (service_role key имеет доступ ко всему)
DROP POLICY IF EXISTS "service_role_all" ON contacts;
CREATE POLICY "service_role_all" ON contacts         FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON deals;
CREATE POLICY "service_role_all" ON deals            FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON activities;
CREATE POLICY "service_role_all" ON activities       FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON ai_queue;
CREATE POLICY "service_role_all" ON ai_queue         FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_only" ON admin_users;
CREATE POLICY "service_only" ON admin_users          FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_only" ON tenant_settings;
CREATE POLICY "service_only" ON tenant_settings      FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON site_events;
CREATE POLICY "service_role_all" ON site_events      FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_only_logs" ON system_logs;
CREATE POLICY "service_only_logs" ON system_logs     FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_only_sessions" ON contact_sessions;
CREATE POLICY "service_only_sessions" ON contact_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON tasks;
CREATE POLICY "service_role_all" ON tasks            FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_orders" ON orders;
CREATE POLICY "service_role_all_orders" ON orders    FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- ══════════════════════════════════════════════════════════════
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS включён' ELSE '❌ RLS ВЫКЛЮЧЕН' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

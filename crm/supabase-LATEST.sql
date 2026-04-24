-- ============================================================
-- ▶ ЗАПУСТИТЬ В SUPABASE SQL EDITOR
-- Supabase Dashboard → SQL Editor → New Query → вставить → Run
-- Безопасно запускать повторно — все команды идемпотентны
-- ============================================================

-- ── ADMIN_USERS: tenant_id + безопасность ───────────────────
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT 'a1000000-0000-0000-0000-000000000001';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Проставить tenant_id всем существующим пользователям
UPDATE admin_users
SET tenant_id = 'a1000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_tenant ON admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_invite ON admin_users(invite_token);

-- ── TENANT SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON tenant_settings;
CREATE POLICY "service_only" ON tenant_settings FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- ── CONTACTS ─────────────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS visitor_id            TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_seen_at          TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_segment            TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_next_action        TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS metadata              JSONB DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source                TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type                  TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telegram_chat_id      TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_otp             TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_otp_expires_at  TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_at       TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_tg    ON contacts(telegram_chat_id);

-- ── DEALS ────────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS items             JSONB   DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency          TEXT    DEFAULT 'RUB';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS suppliers         JSONB   DEFAULT '[]';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS customer_notified BOOLEAN DEFAULT false;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check CHECK (stage IN (
  'new','call','supplier_request','proposal',
  'negotiation','won','delivery','completed','lost','qualified','sent'
));

-- ── ACTIVITIES ───────────────────────────────────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata  JSONB DEFAULT '{}';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS subject   TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS body      TEXT;

-- ── AI_QUEUE ─────────────────────────────────────────────────
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS suggested_message TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS subject           TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS snoozed_until     TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS auto_execute_at   TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS content           TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS deal_id           UUID;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS email_id          UUID REFERENCES emails(id) ON DELETE SET NULL;

ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_action_type_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_action_type_check CHECK (action_type IN (
  'send_email','send_message','make_call','call',
  'send_proposal','create_task','update_stage','send_campaign','schedule'
));
ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_status_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_status_check CHECK (status IN (
  'pending','approved','rejected','executed','auto_executed','snoozed'
));

-- ── TASKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  deal_id    UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  status     TEXT DEFAULT 'pending',
  priority   TEXT DEFAULT 'normal',
  due_at     TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  done_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_deal   ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON tasks;
CREATE POLICY "service_role_all" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- ── CONTACT SESSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  token      TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_sessions_token ON contact_sessions(token);
ALTER TABLE contact_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_sessions" ON contact_sessions;
CREATE POLICY "service_only_sessions" ON contact_sessions FOR ALL USING (true) WITH CHECK (true);

-- ── EMAIL ACCOUNTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  email          TEXT NOT NULL,
  display_name   TEXT,
  provider       TEXT NOT NULL DEFAULT 'custom',
  smtp_host      TEXT, smtp_port INT DEFAULT 587,
  smtp_user      TEXT, smtp_pass TEXT, smtp_secure BOOLEAN DEFAULT false,
  imap_host      TEXT, imap_port INT DEFAULT 993,
  imap_user      TEXT, imap_pass TEXT, imap_tls    BOOLEAN DEFAULT true,
  status         TEXT DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  last_error     TEXT,
  is_default     BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_accounts" ON email_accounts;
CREATE POLICY "service_role_all_email_accounts" ON email_accounts FOR ALL USING (true) WITH CHECK (true);

-- ── EMAILS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  account_id  UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  message_id  TEXT, thread_id TEXT, in_reply_to TEXT,
  direction   TEXT NOT NULL DEFAULT 'inbound',
  from_email  TEXT, from_name TEXT,
  to_emails   JSONB DEFAULT '[]', cc_emails JSONB DEFAULT '[]', bcc_emails JSONB DEFAULT '[]',
  subject     TEXT, body_html TEXT, body_text TEXT,
  is_read     BOOLEAN DEFAULT false, is_starred BOOLEAN DEFAULT false,
  imap_uid    BIGINT, imap_folder TEXT DEFAULT 'INBOX',
  deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]',
  received_at TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_deal    ON emails(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id) WHERE message_id IS NOT NULL;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_emails" ON emails;
CREATE POLICY "service_role_all_emails" ON emails FOR ALL USING (true) WITH CHECK (true);

-- ── SYSTEM LOGS ──────────────────────────────────────────────
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
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_logs" ON system_logs;
CREATE POLICY "service_only_logs" ON system_logs FOR ALL USING (true) WITH CHECK (true);

-- ── RLS на базовые таблицы ────────────────────────────────────
ALTER TABLE contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON contacts;
CREATE POLICY "service_role_all" ON contacts   FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all" ON deals;
CREATE POLICY "service_role_all" ON deals      FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all" ON activities;
CREATE POLICY "service_role_all" ON activities FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all" ON ai_queue;
CREATE POLICY "service_role_all" ON ai_queue   FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_only" ON admin_users;
CREATE POLICY "service_only" ON admin_users    FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- PHASE 2: SOCIAL POSTS (Контент-машина)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'vk')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  content TEXT NOT NULL,
  image_url TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON social_posts;
DROP POLICY IF EXISTS "service_role_all" ON social_posts;
CREATE POLICY "service_role_all" ON social_posts FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- PHASE 2: CALLS (Телефония)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated','ringing','answered','completed','missed','failed')),
  from_number TEXT,
  to_number TEXT,
  duration INTEGER,
  recording_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  ai_sentiment TEXT,
  ai_quality_score INTEGER,
  ai_next_step TEXT,
  initiated_by UUID,
  is_ai_call BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON calls;
DROP POLICY IF EXISTS "service_role_all" ON calls;
CREATE POLICY "service_role_all" ON calls FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- PHASE 2: SITE EVENTS (Трекинг)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  session_id TEXT,
  visitor_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  device TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON site_events;
CREATE POLICY "service_role_all" ON site_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_site_events_tenant ON site_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_events_visitor ON site_events(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_events_type ON site_events(tenant_id, event_type, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- ПРОВЕРКА — должны показать все таблицы с RLS ✅
-- ══════════════════════════════════════════════════════════════
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS включён' ELSE '❌ RLS ВЫКЛЮЧЕН' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

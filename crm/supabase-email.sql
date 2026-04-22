-- ============================================================
-- EMAIL INTEGRATION — выполнить в Supabase SQL Editor
-- ============================================================

-- 1. Подключённые почтовые аккаунты
CREATE TABLE IF NOT EXISTS email_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  email            TEXT NOT NULL,
  display_name     TEXT,
  provider         TEXT NOT NULL DEFAULT 'custom', -- gmail | mailru | yandex | custom
  -- SMTP (для отправки)
  smtp_host        TEXT,
  smtp_port        INT  DEFAULT 587,
  smtp_user        TEXT,
  smtp_pass        TEXT,  -- app-password (не основной пароль!)
  smtp_secure      BOOLEAN DEFAULT false,
  -- IMAP (для получения)
  imap_host        TEXT,
  imap_port        INT  DEFAULT 993,
  imap_user        TEXT,
  imap_pass        TEXT,
  imap_tls         BOOLEAN DEFAULT true,
  -- Статус
  status           TEXT DEFAULT 'active',  -- active | error | disconnected
  last_synced_at   TIMESTAMPTZ,
  last_error       TEXT,
  is_default       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_email_accounts" ON email_accounts
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Письма
CREATE TABLE IF NOT EXISTS emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  account_id    UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  message_id    TEXT,          -- заголовок Message-ID письма
  thread_id     TEXT,          -- для группировки переписки
  in_reply_to   TEXT,          -- Message-ID родительского письма
  direction     TEXT NOT NULL DEFAULT 'inbound',  -- inbound | outbound
  from_email    TEXT,
  from_name     TEXT,
  to_emails     JSONB DEFAULT '[]',   -- [{email, name}]
  cc_emails     JSONB DEFAULT '[]',
  bcc_emails    JSONB DEFAULT '[]',
  subject       TEXT,
  body_html     TEXT,
  body_text     TEXT,
  is_read       BOOLEAN DEFAULT false,
  is_starred    BOOLEAN DEFAULT false,
  imap_uid      BIGINT,         -- UID в IMAP для синхронизации
  imap_folder   TEXT DEFAULT 'INBOX',
  -- Связи с CRM
  deal_id       UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  attachments   JSONB DEFAULT '[]',  -- [{name, size, mime, url}]
  -- Даты
  received_at   TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_deal    ON emails(deal_id);
CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread  ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_ts      ON emails(received_at DESC NULLS LAST, sent_at DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id) WHERE message_id IS NOT NULL;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_emails" ON emails
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Проверка
SELECT 'email_accounts' AS tbl, COUNT(*) FROM email_accounts
UNION ALL
SELECT 'emails', COUNT(*) FROM emails;

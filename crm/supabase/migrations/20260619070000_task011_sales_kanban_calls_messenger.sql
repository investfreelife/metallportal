-- TASK_011 — Доска продаж + Звонки + Омниканальный Messenger.
-- Спека: ~/Documents/Claude/Projects/Мечта/app/queue/SPEC/SALES_KANBAN_MESSENGER_SPEC.md
-- P1 MVP: миграции БД (таблицы + ALTER dream_leads).

-- ─── dream_calls ───
CREATE TABLE IF NOT EXISTS dream_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  lead_id         BIGINT REFERENCES dream_leads(id) ON DELETE SET NULL,
  conversation_id TEXT UNIQUE,
  agent_id        TEXT,
  direction       TEXT NOT NULL DEFAULT 'outbound',
  from_number     TEXT,
  to_number       TEXT,
  status          TEXT,
  result          TEXT,
  qualification   TEXT DEFAULT 'unknown',
  summary         TEXT,
  transcript      JSONB,
  duration_sec    INTEGER,
  sms_sent        BOOLEAN DEFAULT FALSE,
  recording_url   TEXT,
  cost            NUMERIC,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dream_calls_lead   ON dream_calls(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_calls_tenant ON dream_calls(tenant_id, created_at DESC);

-- ─── dream_messages ───
CREATE TABLE IF NOT EXISTS dream_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  lead_id     BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,
  direction   TEXT NOT NULL,
  author      TEXT NOT NULL DEFAULT 'ai',
  body        TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  external_id TEXT,
  call_id     UUID REFERENCES dream_calls(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'sent',
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dream_messages_lead ON dream_messages(lead_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dream_messages_ext ON dream_messages(channel, external_id) WHERE external_id IS NOT NULL;

-- ─── dream_channel_accounts ───
CREATE TABLE IF NOT EXISTS dream_channel_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  channel      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'disconnected',
  display_name TEXT,
  config_meta  JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, channel)
);

-- ─── ALTER dream_leads — sales-поля ───
ALTER TABLE dream_leads
  ADD COLUMN IF NOT EXISTS sales_stage          TEXT DEFAULT 'site_ready',
  ADD COLUMN IF NOT EXISTS qualification        TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS decision_maker_name  TEXT,
  ADD COLUMN IF NOT EXISTS decision_maker_phone TEXT,
  ADD COLUMN IF NOT EXISTS preferred_channel    TEXT,
  ADD COLUMN IF NOT EXISTS callback_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_channel         TEXT,
  ADD COLUMN IF NOT EXISTS unread_count         INTEGER DEFAULT 0;

-- ─── Sergey directive 2026-06-18: причина мусора (автомат-фильтр) ───
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS trash_reason TEXT;
-- Возможные значения: 'auto:has_website', 'auto:closed', 'auto:no_reviews',
-- 'auto:low_rating', 'auto:duplicate', 'auto:wrong_city', 'auto:wrong_niche',
-- 'manual:<свободный текст от Sergey>'

CREATE INDEX IF NOT EXISTS idx_dream_leads_sales_stage ON dream_leads(sales_stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_leads_trash       ON dream_leads(trash_reason) WHERE trash_reason IS NOT NULL;

-- ─── RLS на новые таблицы ───
ALTER TABLE dream_calls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_channel_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dc_service_all  ON dream_calls            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dc_auth_read    ON dream_calls            FOR SELECT TO authenticated USING (true);
CREATE POLICY dm_service_all  ON dream_messages         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dm_auth_read    ON dream_messages         FOR SELECT TO authenticated USING (true);
CREATE POLICY dca_service_all ON dream_channel_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dca_auth_read   ON dream_channel_accounts FOR SELECT TO authenticated USING (true);

COMMENT ON COLUMN dream_leads.sales_stage IS
  'Воронка ПРОДАЖ (отдельная от build_status воронки производства).
   site_ready→to_call→no_answer→reached→qualified→link_sent→negotiating→callback→won|lost';
COMMENT ON COLUMN dream_leads.trash_reason IS
  'Причина попадания в мусор. auto:* = автомат-фильтр; manual:* = Sergey. NULL = не в мусоре.';

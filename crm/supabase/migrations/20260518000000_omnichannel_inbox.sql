-- URGENT 2026-05-17 OMNICHANNEL_INBOX — standalone /inbox page world-class.
-- Sergey directive «как у мирового уровня лучших» — Front App / Missive / HubSpot.
--
-- Migration:
--   1. Extend activities (conversation_id / thread_id / channel / is_internal /
--      sender_name / sender_address / attachments)
--   2. Create conversations (group threading, assignment, priority, SLA, AI)
--   3. Create inbox_templates (saved replies + shortcuts)
--   4. Create inbox_views (user-customizable saved views)
--   5. Realtime publication
--   6. Seed 6 baseline templates

-- ─── 1. Extend activities ────────────────────────────────────────

ALTER TABLE activities ADD COLUMN IF NOT EXISTS conversation_id BIGINT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sender_address TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS activities_conversation_idx ON activities(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS activities_channel_idx ON activities(channel, created_at DESC);

-- ─── 2. conversations table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  subject TEXT,
  channel TEXT NOT NULL,                         -- 'email' / 'phone' / 'sms' / 'telegram' / 'vk' / 'whatsapp' / 'form' / 'chat'
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','pending','closed','snoozed','spam')),
  assigned_to UUID,                              -- agent / manager user id
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent','hot','normal','low')),
  tags TEXT[] DEFAULT '{}',
  snoozed_until TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  last_message_direction TEXT,                    -- 'inbound' / 'outbound'
  unread_count INT DEFAULT 0,
  message_count INT DEFAULT 0,
  sla_response_due_at TIMESTAMPTZ,                -- urgent=1h hot=4h normal=1d
  ai_summary TEXT,                                -- 1-sentence summary
  ai_intent TEXT,                                 -- rfq / question / complaint / spam / etc.
  ai_priority_confidence NUMERIC,                 -- 0-1, для tuning rules
  notes TEXT,                                     -- operator internal notes (отдельно от internal-note messages)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_status_idx ON conversations(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_priority_idx ON conversations(priority, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_assigned_idx ON conversations(assigned_to, status);
CREATE INDEX IF NOT EXISTS conversations_contact_idx ON conversations(contact_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_channel_idx ON conversations(channel, status);
CREATE INDEX IF NOT EXISTS conversations_tags_idx ON conversations USING GIN(tags);
CREATE INDEX IF NOT EXISTS conversations_snoozed_idx ON conversations(snoozed_until) WHERE status = 'snoozed';

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'service_role_all_conversations') THEN
    CREATE POLICY "service_role_all_conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'authenticated_read_conversations') THEN
    CREATE POLICY "authenticated_read_conversations" ON conversations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Trigger: bump updated_at
DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION bump_updated_at();

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── 3. inbox_templates ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,                                 -- "RFQ" / "Pricing" / "Delivery" / "FAQ" / "Greeting"
  channel TEXT,                                  -- NULL = all channels, OR 'email'/'sms'/etc
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,            -- ["{contact.name}", "{product}"]
  shortcut TEXT,                                 -- "/p" → expand
  use_count INT DEFAULT 0,
  created_by UUID,
  is_shared BOOLEAN DEFAULT true,                 -- visible team-wide
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbox_templates_category_idx ON inbox_templates(category);
CREATE INDEX IF NOT EXISTS inbox_templates_channel_idx ON inbox_templates(channel);
CREATE INDEX IF NOT EXISTS inbox_templates_shortcut_idx ON inbox_templates(shortcut) WHERE shortcut IS NOT NULL;

ALTER TABLE inbox_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inbox_templates' AND policyname = 'service_role_all_inbox_templates') THEN
    CREATE POLICY "service_role_all_inbox_templates" ON inbox_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inbox_templates' AND policyname = 'authenticated_read_inbox_templates') THEN
    CREATE POLICY "authenticated_read_inbox_templates" ON inbox_templates FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ─── 4. inbox_views ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_views (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,              -- {channel:'email', status:'open', tags:['hot']}
  icon TEXT,
  sort_order INT DEFAULT 50,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbox_views_user_idx ON inbox_views(user_id, sort_order);
CREATE INDEX IF NOT EXISTS inbox_views_shared_idx ON inbox_views(is_shared, sort_order) WHERE is_shared = true;

ALTER TABLE inbox_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inbox_views' AND policyname = 'service_role_all_inbox_views') THEN
    CREATE POLICY "service_role_all_inbox_views" ON inbox_views FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inbox_views' AND policyname = 'authenticated_read_inbox_views') THEN
    CREATE POLICY "authenticated_read_inbox_views" ON inbox_views FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ─── 5. Seed inbox_templates (6 B2B baselines) ──────────────────

INSERT INTO inbox_templates (name, category, channel, body, shortcut, is_shared) VALUES
  ('Запрос цены — full',
   'Pricing',
   NULL,
   E'Здравствуйте, {contact.first_name}!\n\nСпасибо за обращение. Актуальную цену на {product} пришлю в течение 30 минут.\n\nЧтобы дать точное предложение, уточните:\n• Объём заказа\n• Город доставки\n• Способ оплаты (БН с НДС / наличные)\n\nС уважением, МеталлПортал\n+7 (499) 325-39-69',
   '/price',
   true),

  ('Запрос цены — short (SMS/TG)',
   'Pricing',
   'sms',
   'Здравствуйте! Цены актуальные пришлю в течение 30 минут. Уточните объём + город.',
   '/p',
   true),

  ('Наличие на складе',
   'Availability',
   NULL,
   E'Здравствуйте, {contact.first_name}!\n\nПо вашему запросу:\n{product} — наличие проверю по складу и отвечу в течение 30 минут.\n\nЕсли позиция в наличии — отгрузка в день оплаты. Если нет — закажем под вас, срок 3–7 дней.\n\nС уважением, МеталлПортал',
   '/avail',
   true),

  ('Подтверждение заказа',
   'Order',
   NULL,
   E'Здравствуйте, {contact.first_name}!\n\nЗаказ принят:\n• Позиция: {product}\n• Количество: {qty}\n• Сумма: {amount} ₽\n• Доставка: {delivery_eta}\n\nВыставлю счёт в течение 15 минут. Оплата по реквизитам / наличные при отгрузке.\n\nС уважением, МеталлПортал\n+7 (499) 325-39-69',
   '/order',
   true),

  ('Сроки доставки',
   'Delivery',
   NULL,
   E'Здравствуйте!\n\nДоставка:\n• Москва и МО — на следующий рабочий день\n• Регионы РФ — 2–5 дней транспортной компанией\n• Самовывоз — Москва, склад в Печатниках\n\nТочную стоимость доставки рассчитаю после уточнения адреса и веса груза.\n\nС уважением, МеталлПортал',
   '/delivery',
   true),

  ('Приветствие — first response',
   'Greeting',
   NULL,
   E'Здравствуйте, {contact.first_name}!\n\nСпасибо за обращение в МеталлПортал. Ваш запрос принят, менеджер ответит в течение 30 минут в рабочее время (Пн–Пт 9:00–18:00 МСК).\n\nЕсли срочно — звоните +7 (499) 325-39-69.',
   '/hi',
   true)
ON CONFLICT DO NOTHING;

-- ─── 6. Seed inbox_views (6 baseline smart inboxes — visible all users) ─────

INSERT INTO inbox_views (name, filters, icon, sort_order, is_shared) VALUES
  ('Все открытые',     '{"status": "open"}',                                 '📥', 10, true),
  ('🔥 Горячие',        '{"status": "open", "priority": ["urgent","hot"]}',  '🔥', 20, true),
  ('Непрочитанные',    '{"status": "open", "unread_only": true}',           '🆕', 30, true),
  ('Отложенные',       '{"status": "snoozed"}',                              '⏰', 40, true),
  ('Закрытые',         '{"status": "closed"}',                               '✅', 50, true),
  ('Спам',             '{"status": "spam"}',                                 '🚫', 60, true)
ON CONFLICT DO NOTHING;

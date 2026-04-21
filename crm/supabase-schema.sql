-- =====================
-- ТЕНАНТЫ (клиенты CRM)
-- =====================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry TEXT DEFAULT 'metal',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Первый тенант — МеталлПортал
INSERT INTO tenants (id, name, slug, industry)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'МеталлПортал',
  'metallportal',
  'metal'
);

-- =====================
-- ПОЛЬЗОВАТЕЛИ CRM
-- =====================
CREATE TABLE crm_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  full_name TEXT,
  role TEXT DEFAULT 'manager' CHECK (role IN ('owner', 'manager', 'viewer')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- КОНТАКТЫ
-- =====================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  full_name TEXT,
  company_name TEXT,
  position TEXT,
  phone TEXT,
  email TEXT,
  telegram TEXT,
  whatsapp TEXT,
  type TEXT DEFAULT 'lead' CHECK (type IN ('lead', 'client', 'partner', 'supplier')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'active', 'inactive', 'blocked')),
  ai_score INTEGER DEFAULT 0 CHECK (ai_score BETWEEN 0 AND 100),
  ai_segment TEXT,
  ai_next_action TEXT,
  ai_next_action_at TIMESTAMPTZ,
  source TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  assigned_to UUID REFERENCES crm_users(id),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- СДЕЛКИ
-- =====================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL,
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'RUB',
  stage TEXT DEFAULT 'new' CHECK (stage IN (
    'new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
  )),
  lost_reason TEXT,
  ai_win_probability INTEGER DEFAULT 0,
  ai_recommendation TEXT,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES crm_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- АКТИВНОСТИ
-- =====================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  type TEXT NOT NULL CHECK (type IN (
    'call', 'email', 'message', 'note', 'meeting', 'task', 'site_visit', 'ai_action'
  )),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body TEXT,
  call_duration INTEGER,
  call_recording_url TEXT,
  call_transcript TEXT,
  call_summary TEXT,
  created_by UUID REFERENCES crm_users(id),
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- ОЧЕРЕДЬ РЕШЕНИЙ ИИ
-- =====================
CREATE TABLE ai_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_email', 'send_message', 'make_call', 'send_proposal',
    'create_task', 'update_stage', 'send_campaign'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  subject TEXT,
  content TEXT NOT NULL,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'executed', 'auto_executed'
  )),
  approved_by UUID REFERENCES crm_users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  edited_content TEXT,
  auto_execute_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- ТРЕКИНГ САЙТА
-- =====================
CREATE TABLE site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
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

-- =====================
-- RLS ПОЛИТИКИ
-- =====================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM crm_users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE POLICY "tenant_isolation" ON contacts
  FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation" ON deals
  FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation" ON activities
  FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation" ON ai_queue
  FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation" ON site_events
  FOR ALL USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation" ON crm_users
  FOR ALL USING (tenant_id = get_tenant_id());

-- =====================
-- ИНДЕКСЫ
-- =====================
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_score ON contacts(tenant_id, ai_score DESC);
CREATE INDEX idx_deals_tenant_stage ON deals(tenant_id, stage);
CREATE INDEX idx_activities_contact ON activities(contact_id, created_at DESC);
CREATE INDEX idx_ai_queue_pending ON ai_queue(tenant_id, status) WHERE status = 'pending';
CREATE INDEX idx_site_events_visitor ON site_events(tenant_id, visitor_id, created_at DESC);

-- =====================
-- ПОСЛЕ РЕГИСТРАЦИИ: добавить себя в crm_users
-- =====================
-- INSERT INTO crm_users (id, tenant_id, full_name, role)
-- VALUES (
--   '<ваш auth.users UUID>',
--   'a1000000-0000-0000-0000-000000000001',
--   'Ваше Имя',
--   'owner'
-- );

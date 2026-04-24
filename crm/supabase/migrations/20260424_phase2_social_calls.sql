-- Phase 2: Social Posts
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
CREATE POLICY "tenant_isolation" ON social_posts FOR ALL USING (tenant_id = get_tenant_id());

-- Phase 2: Calls
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
CREATE POLICY "tenant_isolation" ON calls FOR ALL USING (tenant_id = get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id, created_at DESC);

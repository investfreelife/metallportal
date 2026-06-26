-- DREAM — third tenant: «Мечта — Лендинг-фабрика».
--
-- Проект: парсим бизнес Москвы без сайтов (OSM + Bright Data + Yandex.Карты)
-- → генерируем готовый HTML лендинг под нишу → outreach в WhatsApp/TG
-- → продаём за 25 000 ₽ под ключ.
--
-- Workflow (parser → enrich → generate → outreach → sale):
--   1. parser/parser_moscow.py OSM Overpass → бизнесы без сайтов
--   2. app/bd_pipeline.py — Bright Data Web Unlocker → details (фото, отзывы, услуги)
--   3. app/generator.py — генерация HTML лендинга
--   4. outreach через CRM → продажа
--
-- Источник правды локально: ~/Documents/Claude/Projects/Мечта/landings/<slug>/

-- ─── 1. Tenant ────────────────────────────────────────────────────

INSERT INTO tenants (id, name, slug, industry, settings)
VALUES (
  '11111111-2222-3333-4444-555555555555',
  'Мечта — Лендинг-фабрика',
  'dream',
  'landing_factory',
  '{
    "default_price_rub": 25000,
    "parser_modes": ["osm", "bright_data"],
    "outreach_channels": ["whatsapp", "telegram", "phone"],
    "target_revenue_per_week_rub": 100000,
    "target_deals_per_week": 4
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  industry = EXCLUDED.industry,
  settings = EXCLUDED.settings;

-- ─── 2. dream_leads — основная таблица ────────────────────────────

CREATE TABLE IF NOT EXISTS dream_leads (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) DEFAULT '11111111-2222-3333-4444-555555555555',

  -- identity
  slug TEXT UNIQUE NOT NULL,           -- 'avtoclean'
  name TEXT NOT NULL,                  -- 'Avtoclean'
  niche TEXT,                          -- 'Автомойка / Автосервис'
  category_key TEXT,                   -- 'amenity=car_wash' (OSM)

  -- location
  city TEXT DEFAULT 'Москва',
  address TEXT,
  metro_nearest TEXT,
  geo_lat REAL,
  geo_lon REAL,

  -- contacts
  phone TEXT,
  phone_display TEXT,
  email TEXT,
  yandex_url TEXT,
  yandex_id TEXT,
  gis_url TEXT,
  has_website BOOLEAN DEFAULT false,
  website_url TEXT,
  social_json JSONB DEFAULT '{}'::jsonb,

  -- parsing metrics (богатство данных)
  rating REAL,
  reviews_count INT DEFAULT 0,
  ratings_count INT DEFAULT 0,
  services_count INT DEFAULT 0,
  photos_count INT DEFAULT 0,
  features_json JSONB DEFAULT '[]'::jsonb,
  hours_json JSONB DEFAULT '{}'::jsonb,
  description_short TEXT,
  description_long TEXT,
  completeness_score REAL,            -- 0.0 — 1.0 (TASK_007: Avtoclean 0.90)

  -- folders/files (источник правды на диске)
  folder_path TEXT,                    -- '~/Documents/Claude/Projects/Мечта/landings/avtoclean'
  landing_html_path TEXT,              -- 'index.html' внутри folder
  landing_deployed_url TEXT,           -- 'https://avtoclean.dreamlandings.ru' после deploy

  -- sales workflow
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','enriched','generated','outreach','contacted','hot','proposal','won','lost','wont_do')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('urgent','hot','normal','low')),
  tags TEXT[] DEFAULT '{}',
  price INT DEFAULT 25000,
  notes TEXT,
  ai_summary TEXT,
  ai_pitch TEXT,                       -- персональный pitch для outreach
  assigned_to UUID,

  -- enrichment provenance
  enrichment_sources TEXT[] DEFAULT '{}',  -- ['osm', 'yandex_maps', 'bright_data']
  parser_run_id BIGINT,
  enriched_at TIMESTAMPTZ,

  -- timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS dream_leads_status_idx ON dream_leads(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS dream_leads_niche_idx ON dream_leads(niche);
CREATE INDEX IF NOT EXISTS dream_leads_rating_idx ON dream_leads(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS dream_leads_tenant_idx ON dream_leads(tenant_id, status);

ALTER TABLE dream_leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dream_leads' AND policyname = 'service_role_all_dream_leads') THEN
    CREATE POLICY "service_role_all_dream_leads" ON dream_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dream_leads' AND policyname = 'authenticated_read_dream_leads') THEN
    CREATE POLICY "authenticated_read_dream_leads" ON dream_leads FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- bump updated_at
DROP TRIGGER IF EXISTS trg_dream_leads_updated_at ON dream_leads;
CREATE TRIGGER trg_dream_leads_updated_at
  BEFORE UPDATE ON dream_leads
  FOR EACH ROW EXECUTE FUNCTION bump_updated_at();

-- realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dream_leads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dream_leads;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── 3. dream_activities — outreach + sales journal ───────────────

CREATE TABLE IF NOT EXISTS dream_activities (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- 'call' / 'whatsapp' / 'telegram' / 'email' / 'note' / 'status_change' / 'generated_landing'
  direction TEXT,                       -- 'inbound' / 'outbound'
  channel TEXT,                         -- canonical name
  subject TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,                      -- 'sergey' / 'parser' / 'agent' / etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dream_activities_lead_idx ON dream_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dream_activities_type_idx ON dream_activities(type, created_at DESC);

ALTER TABLE dream_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dream_activities' AND policyname = 'service_role_all_dream_activities') THEN
    CREATE POLICY "service_role_all_dream_activities" ON dream_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dream_activities' AND policyname = 'authenticated_read_dream_activities') THEN
    CREATE POLICY "authenticated_read_dream_activities" ON dream_activities FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dream_activities') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dream_activities;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── 4. dream_status_history — audit log ──────────────────────────

CREATE TABLE IF NOT EXISTS dream_status_history (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  by_user TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dream_status_history_lead_idx ON dream_status_history(lead_id, created_at DESC);

ALTER TABLE dream_status_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dream_status_history' AND policyname = 'service_role_all_dream_status_history') THEN
    CREATE POLICY "service_role_all_dream_status_history" ON dream_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 5. dream_parser_runs — мониторинг парсера ────────────────────

CREATE TABLE IF NOT EXISTS dream_parser_runs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                 -- 'osm' / 'bright_data_discover' / 'bright_data_unlocker' / 'manual'
  mode TEXT,                            -- 'discover' / 'enrich' / 'generate'
  city TEXT,
  niches TEXT[],
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','success','partial','failed','cancelled')),
  leads_found INT DEFAULT 0,
  leads_imported INT DEFAULT 0,
  leads_skipped INT DEFAULT 0,
  cost_usd NUMERIC(10, 4) DEFAULT 0,
  log_path TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS dream_parser_runs_started_idx ON dream_parser_runs(started_at DESC);

ALTER TABLE dream_parser_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dream_parser_runs' AND policyname = 'service_role_all_dream_parser_runs') THEN
    CREATE POLICY "service_role_all_dream_parser_runs" ON dream_parser_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dream_parser_runs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dream_parser_runs;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── 6. Status change trigger → status_history ───────────────────

CREATE OR REPLACE FUNCTION dream_log_status_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO dream_status_history (lead_id, from_status, to_status, by_user, reason)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.assigned_to::text, 'system'), '');

    -- Auto-stamp contacted_at and sold_at
    IF NEW.status = 'contacted' AND OLD.contacted_at IS NULL THEN
      NEW.contacted_at := NOW();
    END IF;
    IF NEW.status = 'won' THEN
      NEW.sold_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dream_leads_status_change ON dream_leads;
CREATE TRIGGER trg_dream_leads_status_change
  BEFORE UPDATE ON dream_leads
  FOR EACH ROW EXECUTE FUNCTION dream_log_status_change();

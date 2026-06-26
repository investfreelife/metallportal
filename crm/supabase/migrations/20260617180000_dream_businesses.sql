-- ЭТАП 1 (Discovery) + ЭТАП 2 (Filter) для проекта «Мечта — Лендинг-фабрика».
-- Sergey directive 2026-06-17: «снеси все, строим заново. Парсер — три вкладки:
-- (1) Всего спарсено, (2) Без сайта, (3) Полный парсинг».
--
-- SPEC: ~/Documents/Claude/Projects/Мечта/app/queue/SPEC/PARSING_PIPELINE_SPEC.md
-- Источник правды для парсера: ~/Documents/Claude/Projects/Мечта/app/data/bd_pipeline.db
-- (SQLite, локально на маке Sergey'я). Этот скрипт делает зеркало в Supabase для CRM.

-- ─── 1. businesses — ВСЁ что нашёл Discovery ────────────────────

CREATE TABLE IF NOT EXISTS dream_businesses (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555',
  -- дедупликация по канон-ключу (sha1 name+address+phone)
  canon_key TEXT UNIQUE NOT NULL,
  local_id INTEGER,  -- id в локальной SQLite (для синка)

  -- Идентификация
  name TEXT NOT NULL,
  category TEXT,
  niche TEXT,
  city TEXT DEFAULT 'Москва',
  address TEXT,
  lat NUMERIC,
  lon NUMERIC,

  -- Контакты
  phone TEXT,
  email TEXT,

  -- Источники (yandex/gis)
  yandex_url TEXT,
  gis_url TEXT,

  -- Соцсети
  instagram TEXT,
  vk TEXT,
  telegram TEXT,
  whatsapp TEXT,

  -- Главный фильтр ЭТАПА 2 — has_website
  has_website INTEGER DEFAULT 0,
  website_url TEXT,

  -- Доп. публичные данные с дискавери
  rating NUMERIC,
  review_count INTEGER,
  opening_hours TEXT,

  -- Сырой dump (OSM tags + другое)
  raw_data JSONB,

  -- Жизненный цикл
  discovered_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  enriched_at TIMESTAMPTZ,
  enrichment_status TEXT DEFAULT 'pending',  -- pending / running / success / failed / skipped

  -- Pipeline далее
  site_generated INTEGER DEFAULT 0,
  site_url TEXT,
  outreach_sent INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  sold_price INTEGER,
  sold_at TIMESTAMPTZ,

  -- Если enriched — линк на dream_leads
  dream_lead_id BIGINT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dream_biz_tenant ON dream_businesses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dream_biz_no_website ON dream_businesses(has_website, enrichment_status);
CREATE INDEX IF NOT EXISTS idx_dream_biz_niche_city ON dream_businesses(niche, city);
CREATE INDEX IF NOT EXISTS idx_dream_biz_discovered ON dream_businesses(discovered_at DESC);

ALTER TABLE dream_businesses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dream_businesses' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON dream_businesses FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dream_businesses' AND policyname='authenticated_read') THEN
    CREATE POLICY authenticated_read ON dream_businesses FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='dream_businesses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dream_businesses;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ─── 2. discovery_runs — история запусков ЭТАПА 1 ──────────────

CREATE TABLE IF NOT EXISTS dream_discovery_runs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555',
  local_id INTEGER,
  source TEXT NOT NULL,           -- 'osm_overpass' / 'bd_discover'
  niche TEXT,
  city TEXT DEFAULT 'Москва',
  query TEXT,
  found INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',  -- running / success / failed
  cost_usd NUMERIC DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dream_disc_started ON dream_discovery_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_disc_niche ON dream_discovery_runs(niche, city);

ALTER TABLE dream_discovery_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dream_discovery_runs' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON dream_discovery_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dream_discovery_runs' AND policyname='authenticated_read') THEN
    CREATE POLICY authenticated_read ON dream_discovery_runs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

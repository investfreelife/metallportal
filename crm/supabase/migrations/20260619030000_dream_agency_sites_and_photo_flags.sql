-- Sergey directive 2026-06-18:
-- 1. Колонки priority/deleted/note на dream_lead_photos (уже добавлены через Mgmt API, делаем idempotent)
-- 2. Таблица dream_agency_sites — наши собственные сайты студии (Nimbo),
--    НЕ привязаны к лидам, живут на investfreelife.github.io отдельно от клиентских лендингов

ALTER TABLE dream_lead_photos ADD COLUMN IF NOT EXISTS priority BOOLEAN DEFAULT FALSE;
ALTER TABLE dream_lead_photos ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE dream_lead_photos ADD COLUMN IF NOT EXISTS note TEXT;
CREATE INDEX IF NOT EXISTS idx_dream_photos_priority ON dream_lead_photos(lead_id) WHERE priority = TRUE;
CREATE INDEX IF NOT EXISTS idx_dream_photos_deleted ON dream_lead_photos(lead_id) WHERE deleted = TRUE;

-- ─────── Сайты студии (Nimbo) ───────
CREATE TABLE IF NOT EXISTS dream_agency_sites (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'studio',     -- 'studio' / 'demo' / 'experiment' / 'landing-template'
  url TEXT NOT NULL,                        -- https://investfreelife.github.io/<path>/
  description TEXT,
  reference TEXT,                           -- источник вдохновения (hellomonday.com и т.д.)
  features TEXT[],                          -- ['three.js','GSAP','Lenis','custom cursor']
  preview_url TEXT,                         -- og.jpg или screenshot
  is_featured BOOLEAN DEFAULT FALSE,        -- показывать в шапке /dream
  status TEXT DEFAULT 'live',               -- live / draft / archived
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dream_agency_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY das_service_all ON dream_agency_sites FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY das_auth_read   ON dream_agency_sites FOR SELECT TO authenticated USING (true);

-- ─────── Seed: всё что вчера сделали (из SITES_REGISTRY.md) ───────
INSERT INTO dream_agency_sites (tenant_id, slug, title, kind, url, reference, features, is_featured, status, description)
VALUES
  ('11111111-2222-3333-4444-555555555555', 'main',   'Nimbo Studio — Главная (v3)', 'studio', 'https://investfreelife.github.io/',         'Awwwards/Active Theory', ARRAY['Three.js','шейдерный 3D','GSAP','Lenis','кастомный курсор']::text[], TRUE,  'live', 'Тёмный, шейдерный 3D-объект, частицы'),
  ('11111111-2222-3333-4444-555555555555', 'monday', 'Nimbo Studio — Monday',       'studio', 'https://investfreelife.github.io/monday/',   'hellomonday.com',         ARRAY['Editorial','кремовый фон','italic-serif','кейс-сетка']::text[],        FALSE, 'live', 'Светлый editorial, гигантская типографика'),
  ('11111111-2222-3333-4444-555555555555', 'studio', 'Nimbo Studio — Флагман',      'studio', 'https://investfreelife.github.io/studio/',   'hellomonday.com (deep)',  ARRAY['WebGL displaced-sphere','fresnel','RGB-split hover','horizontal pinned scroll']::text[], TRUE, 'live', 'Editorial + WebGL объект, курсор-хамелеон'),
  ('11111111-2222-3333-4444-555555555555', 'huge',   'Nimbo — HUGE концепт',        'experiment', 'https://investfreelife.github.io/huge/', NULL, NULL, FALSE, 'live', 'Экспериментальный концепт'),
  ('11111111-2222-3333-4444-555555555555', 'leads',  'Nimbo — Шоукейс лидов',       'demo',     'https://investfreelife.github.io/leads/', NULL, NULL, FALSE, 'live', 'Витрина лидов для презентаций')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  reference = EXCLUDED.reference,
  features = EXCLUDED.features,
  is_featured = EXCLUDED.is_featured,
  description = EXCLUDED.description,
  updated_at = NOW();

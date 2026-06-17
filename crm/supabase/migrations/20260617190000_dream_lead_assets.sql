-- Фото / отзывы / услуги лидов «Мечта» — раньше читались с диска Sergey'я.
-- Vercel serverless не имеет доступа → переносим всё в Supabase.

CREATE TABLE IF NOT EXISTS dream_lead_photos (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  url TEXT NOT NULL,             -- Supabase Storage public URL
  storage_path TEXT,              -- bucket/path key (для cleanup)
  source_url TEXT,                -- оригинал на yandex CDN
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_dream_photos_lead ON dream_lead_photos(lead_id, idx);

CREATE TABLE IF NOT EXISTS dream_lead_reviews (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  author TEXT,
  rating NUMERIC,
  review_date TEXT,                -- ISO дата или "2024-09-24" / freeform — как в исходнике
  text TEXT,
  source TEXT DEFAULT 'yandex_maps',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_dream_reviews_lead ON dream_lead_reviews(lead_id, idx);

CREATE TABLE IF NOT EXISTS dream_lead_services (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC,
  unit TEXT,
  description TEXT,
  source TEXT DEFAULT 'yandex_menu',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_dream_services_lead ON dream_lead_services(lead_id, idx);

-- Дополнительное хранение готового лендинга
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS landing_storage_path TEXT;
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS landing_public_url TEXT;

-- RLS — как остальные dream_*
ALTER TABLE dream_lead_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_lead_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_lead_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  FOR tbl IN SELECT unnest(ARRAY['dream_lead_photos','dream_lead_reviews','dream_lead_services']) AS t LOOP
    EXECUTE format('CREATE POLICY service_role_all ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl.t);
    EXECUTE format('CREATE POLICY authenticated_read ON %I FOR SELECT TO authenticated USING (true)', tbl.t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

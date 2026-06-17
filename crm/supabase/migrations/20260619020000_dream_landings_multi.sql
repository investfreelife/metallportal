-- Sergey directive 2026-06-17: «агент будет делать НАШИ ЛЕНДИНГИ РАЗНЫЕ чтоб
-- не забыть с разными страницами». Один лид → много вариантов лендинга
-- (modern/classic/minimal × v1/v2/v3), у каждого набор страниц.

-- ─────── dream_landings — один ряд = один вариант лендинга ───────
CREATE TABLE IF NOT EXISTS dream_landings (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,

  -- идентификация варианта
  variant TEXT NOT NULL,              -- 'modern' / 'classic' / 'minimal' / 'mobile-first' / 'bold'
  version TEXT NOT NULL DEFAULT 'v1', -- 'v1', 'v2' (если перегенерили тот же variant)
  template_id TEXT,                   -- 'autoservice_modern_v1' — id шаблона из templates/

  -- куда положили файлы
  storage_prefix TEXT NOT NULL,       -- 'avtoclean/modern-v1/' — общий префикс всех файлов
  entry_url TEXT NOT NULL,            -- public URL главной (index.html)
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- pages = [{slug, title, storage_path, url, bytes?}]
  -- Например:
  -- [{"slug":"index","title":"Главная","storage_path":"avtoclean/modern-v1/index.html",
  --   "url":"https://.../public/dream-landings/avtoclean/modern-v1/index.html","bytes":48123},
  --  {"slug":"services","title":"Услуги","storage_path":"avtoclean/modern-v1/services.html","url":"..."},
  --  {"slug":"reviews","title":"Отзывы","storage_path":"avtoclean/modern-v1/reviews.html","url":"..."},
  --  {"slug":"gallery","title":"Фото","storage_path":"avtoclean/modern-v1/gallery.html","url":"..."},
  --  {"slug":"contacts","title":"Контакты","storage_path":"avtoclean/modern-v1/contacts.html","url":"..."}]

  -- метаданные генерации (для debug и для обучения)
  meta JSONB DEFAULT '{}'::jsonb,
  -- meta = {generator_model, color_scheme, hero_style, prompts, ai_cost_usd, duration_sec, ...}

  -- статус и выбор
  status TEXT NOT NULL DEFAULT 'draft',   -- draft / published / archived / failed
  is_chosen BOOLEAN DEFAULT FALSE,         -- активный = пойдёт в outreach; см. триггер
  preview_screenshot_url TEXT,             -- скриншот главной для UI-галереи

  -- внешний deploy (когда выкатим на Yandex Cloud / GH Pages)
  deployed_url TEXT,                       -- финальный URL для outreach (поверх Storage URL)
  deploy_target TEXT,                      -- 'supabase_storage' / 'yandex_cloud' / 'github_pages' / 'netlify'
  deployed_at TIMESTAMPTZ,

  -- timestamps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (lead_id, variant, version)
);

CREATE INDEX IF NOT EXISTS idx_dream_landings_lead   ON dream_landings(lead_id);
CREATE INDEX IF NOT EXISTS idx_dream_landings_chosen ON dream_landings(lead_id) WHERE is_chosen = TRUE;
CREATE INDEX IF NOT EXISTS idx_dream_landings_tenant ON dream_landings(tenant_id);

-- ─────── Логи запусков генерации (для отладки и финансов) ───────
CREATE TABLE IF NOT EXISTS dream_landing_generations (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES dream_leads(id) ON DELETE SET NULL,
  landing_id BIGINT REFERENCES dream_landings(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL,
  agent TEXT,                 -- 'sergey-site-coder' / 'manual'
  variant TEXT,
  version TEXT,
  template_id TEXT,
  status TEXT NOT NULL,       -- 'running' / 'success' / 'failed'
  error_message TEXT,
  pages_generated INT DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  duration_sec NUMERIC,
  metadata JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dream_landing_gens_lead    ON dream_landing_generations(lead_id);
CREATE INDEX IF NOT EXISTS idx_dream_landing_gens_started ON dream_landing_generations(started_at DESC);

-- ─────── Триггер: при is_chosen=TRUE — обновляет dream_leads ───────
-- Логика: только один лендинг на лид может быть chosen.
-- Когда ставится TRUE — снимаем флаг с предыдущего и обновляем legacy-поля
-- landing_storage_path/landing_public_url в dream_leads чтобы UI карточки лида
-- (вкладка «Лендинг») и outreach использовали выбранный вариант.
CREATE OR REPLACE FUNCTION dream_landing_chosen_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_chosen = TRUE AND (TG_OP = 'INSERT' OR OLD.is_chosen IS DISTINCT FROM NEW.is_chosen) THEN
    -- снимаем chosen с других вариантов того же лида
    UPDATE dream_landings
       SET is_chosen = FALSE, updated_at = NOW()
     WHERE lead_id = NEW.lead_id AND id != NEW.id AND is_chosen = TRUE;

    -- обновляем legacy-поля на dream_leads
    UPDATE dream_leads
       SET landing_storage_path = (NEW.storage_prefix || 'index.html'),
           landing_public_url   = NEW.entry_url,
           landing_deployed_url = COALESCE(NEW.deployed_url, NEW.entry_url),
           updated_at = NOW()
     WHERE id = NEW.lead_id;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dream_landing_chosen_sync ON dream_landings;
CREATE TRIGGER trg_dream_landing_chosen_sync
  BEFORE INSERT OR UPDATE ON dream_landings
  FOR EACH ROW EXECUTE FUNCTION dream_landing_chosen_sync();

-- ─────── RLS ───────
ALTER TABLE dream_landings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_landing_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY dl_service_all ON dream_landings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dl_auth_read   ON dream_landings FOR SELECT TO authenticated USING (true);
CREATE POLICY dlg_service_all ON dream_landing_generations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dlg_auth_read   ON dream_landing_generations FOR SELECT TO authenticated USING (true);

-- ─────── Backfill: Avtoclean уже имеет один index.html → создаём ряд ───────
INSERT INTO dream_landings (lead_id, tenant_id, variant, version, template_id,
                            storage_prefix, entry_url, pages, status, is_chosen,
                            generated_at)
SELECT
  dl.id,
  dl.tenant_id,
  'legacy',
  'v0',
  'manual_avtoclean_v0',
  'avtoclean/',
  dl.landing_public_url,
  jsonb_build_array(
    jsonb_build_object(
      'slug', 'index',
      'title', 'Главная',
      'storage_path', 'avtoclean/index.html',
      'url', dl.landing_public_url
    )
  ),
  'published',
  TRUE,
  NOW()
FROM dream_leads dl
WHERE dl.slug = 'avtoclean'
  AND dl.landing_public_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dream_landings WHERE lead_id = dl.id);

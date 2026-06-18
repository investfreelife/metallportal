-- Sergey directive 2026-06-18 (ТЗ кодеру `TASK_CRM_approval_section.md`):
-- approval-first workflow для лидов перед массовым производством сайтов.
--
-- Состояния dream_leads.build_status:
--   parsed         — исходное состояние, агент-парсер только что положил данные
--   plan_proposed  — агент-парсер сгенерил build_plan_json с предложениями
--   approved       — Sergey утвердил план; агент-кодер может собирать
--   built          — лендинг(и) сгенерированы (dream_landings содержит >=1 строку)
--   chosen         — Sergey выбрал активный вариант (is_chosen=true где-то)
--
-- Агент-кодер ОБЯЗАН проверять build_status='approved' ИЛИ выше перед сборкой.

ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS build_status TEXT;
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS build_plan_json JSONB;
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS build_approved_at TIMESTAMPTZ;
ALTER TABLE dream_leads ADD COLUMN IF NOT EXISTS build_approved_by TEXT;

-- Дефолт для существующих лидов
UPDATE dream_leads SET build_status = 'parsed' WHERE build_status IS NULL;

-- Constraint на возможные значения
DO $$ BEGIN
  ALTER TABLE dream_leads ADD CONSTRAINT dream_leads_build_status_check
    CHECK (build_status IN ('parsed','plan_proposed','approved','built','chosen'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_dream_leads_build_status ON dream_leads(build_status);

COMMENT ON COLUMN dream_leads.build_status     IS 'parsed→plan_proposed→approved→built→chosen. Sergey approval gate.';
COMMENT ON COLUMN dream_leads.build_plan_json  IS 'Полный план сборки: design_ref, sections[], photo_assignments{idx→section}, video{photo_idx,engine,enabled}, seo{title,description,h1,section_texts}, reviews_excluded[]';

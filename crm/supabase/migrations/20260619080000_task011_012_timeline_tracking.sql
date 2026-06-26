-- TASK_011 §1.5 + TASK_012 §1.6+§7.2 — единый таймлайн касаний + трекинг визитов.

-- ─────── §1.5 dream_activities — единый таймлайн ───────
-- ВНИМАНИЕ: dream_activities уже существует со старой схемой.
-- Мягкая миграция: добавляем недостающие колонки, заполняем из старых.

ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS ts        TIMESTAMPTZ;
ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS actor     TEXT;
ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS title     TEXT;
ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS ref_table TEXT;
ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS ref_id    UUID;
ALTER TABLE dream_activities ADD COLUMN IF NOT EXISTS meta      JSONB DEFAULT '{}'::jsonb;

-- Backfill из старых колонок (где новые NULL)
UPDATE dream_activities SET
  ts        = COALESCE(ts, created_at),
  actor     = COALESCE(actor, created_by, 'system'),
  title     = COALESCE(title, subject),
  meta      = COALESCE(meta, metadata, '{}'::jsonb),
  tenant_id = COALESCE(tenant_id, '11111111-2222-3333-4444-555555555555'::uuid)
WHERE ts IS NULL OR actor IS NULL OR meta IS NULL OR tenant_id IS NULL;

-- Индекс под timeline-запрос
CREATE INDEX IF NOT EXISTS idx_dream_activities_lead_ts ON dream_activities(lead_id, ts DESC);

-- Канонический набор type-значений (комментарий)
COMMENT ON COLUMN dream_activities.type IS
  'call | sms | email | telegram | whatsapp | max | vk | site_click | site_view | phone_click | cta_click | form_submit | stage_change | qualification | reminder_set | note | link_sent';
COMMENT ON COLUMN dream_activities.actor IS 'robot | human | client | system';

-- ─────── §1.6 dream_link_events — клики и поведение на сайте ───────
CREATE TABLE IF NOT EXISTS dream_link_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  lead_id     BIGINT REFERENCES dream_leads(id) ON DELETE SET NULL,
  token       TEXT,
  type        TEXT NOT NULL,    -- click | pageview | heartbeat | scroll | phone_click | cta_click | form_submit
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip          TEXT,
  ua          TEXT,
  referrer    TEXT,
  duration_sec INTEGER,
  scroll_pct  INTEGER,
  meta        JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_dream_link_events_lead  ON dream_link_events(lead_id, ts);
CREATE INDEX IF NOT EXISTS idx_dream_link_events_token ON dream_link_events(token, ts);

ALTER TABLE dream_link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY dle_service_all ON dream_link_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dle_auth_read   ON dream_link_events FOR SELECT TO authenticated USING (true);

-- ─────── §1.6 ALTER dream_leads — поля трекинга и дожима ───────
ALTER TABLE dream_leads
  ADD COLUMN IF NOT EXISTS track_token             TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS first_visit_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_visit_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visits_count            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_scroll_pct          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_time_on_site_sec  INTEGER DEFAULT 0,
  -- §1.4 ДОЖИМ (next action)
  ADD COLUMN IF NOT EXISTS next_action_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_goal        TEXT,
  ADD COLUMN IF NOT EXISTS next_action_by          TEXT DEFAULT 'robot',
  ADD COLUMN IF NOT EXISTS call_attempts           INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_dream_leads_next_action ON dream_leads(next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dream_leads_track_token ON dream_leads(track_token)    WHERE track_token IS NOT NULL;

-- ─────── Триггер для UPSERT агрегатов визитов при INSERT dream_link_events ───────
CREATE OR REPLACE FUNCTION dream_link_events_aggregate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  -- pageview/click — увеличиваем visits_count и first/last_visit
  IF NEW.type IN ('click','pageview') THEN
    UPDATE dream_leads
       SET visits_count   = COALESCE(visits_count, 0) + 1,
           first_visit_at = COALESCE(first_visit_at, NEW.ts),
           last_visit_at  = NEW.ts
     WHERE id = NEW.lead_id;
  END IF;

  -- heartbeat — обновляем total_time + last_visit
  IF NEW.type = 'heartbeat' AND NEW.duration_sec IS NOT NULL THEN
    UPDATE dream_leads
       SET total_time_on_site_sec = COALESCE(total_time_on_site_sec, 0) + NEW.duration_sec,
           last_visit_at = NEW.ts
     WHERE id = NEW.lead_id;
  END IF;

  -- scroll — обновляем max_scroll_pct
  IF NEW.type = 'scroll' AND NEW.scroll_pct IS NOT NULL THEN
    UPDATE dream_leads
       SET max_scroll_pct = GREATEST(COALESCE(max_scroll_pct, 0), NEW.scroll_pct)
     WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dream_link_events_aggregate ON dream_link_events;
CREATE TRIGGER trg_dream_link_events_aggregate
  AFTER INSERT ON dream_link_events
  FOR EACH ROW EXECUTE FUNCTION dream_link_events_aggregate();

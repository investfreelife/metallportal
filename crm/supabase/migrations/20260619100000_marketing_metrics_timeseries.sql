-- ТЗ #2026-06-19 (ТАРГЕТ): time-series метрики + реестр счётчиков Метрики.
-- Существующая marketing_metrics с узкой схемой metric_name/metric_value
-- переименовывается в _legacy (5044 legacy строки сохранены).

ALTER TABLE marketing_metrics RENAME TO marketing_metrics_legacy;

-- ─────── marketing_metrics: time-series по ТЗ ───────
CREATE TABLE marketing_metrics (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid,
  date            DATE NOT NULL,
  channel         TEXT NOT NULL,
  campaign_slug   TEXT,
  source          TEXT NOT NULL,                    -- 'direct_api' / 'metrika_api' / 'webmaster_api' / 'manual' / 'daemon'
  impressions     BIGINT DEFAULT 0,
  clicks          BIGINT DEFAULT 0,
  cost_micros     BIGINT DEFAULT 0,                 -- ₽ × 1e6 (как у Директа)
  visits          BIGINT DEFAULT 0,
  leads           INTEGER DEFAULT 0,
  conversions     INTEGER DEFAULT 0,
  goal_reaches    JSONB DEFAULT '{}'::jsonb,        -- {"start_project":12,"email_click":3}
  ctr             NUMERIC,
  cpl_micros      BIGINT,
  bounce_rate     NUMERIC,
  avg_visit_sec   NUMERIC,
  robot_share     NUMERIC,                          -- доля роботов (антифрод)
  raw             JSONB,                            -- сырой ответ источника
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Идемпотентность апсертов: NULL → '' для campaign_slug в ключе
CREATE UNIQUE INDEX uq_marketing_metrics_key
  ON marketing_metrics (tenant_id, date, channel, COALESCE(campaign_slug, ''), source);

CREATE INDEX idx_marketing_metrics_tenant_date    ON marketing_metrics(tenant_id, date DESC);
CREATE INDEX idx_marketing_metrics_channel_date   ON marketing_metrics(channel, date DESC);
CREATE INDEX idx_marketing_metrics_campaign_date  ON marketing_metrics(campaign_slug, date DESC) WHERE campaign_slug IS NOT NULL;

ALTER TABLE marketing_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY mm_service_all ON marketing_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY mm_auth_read   ON marketing_metrics FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE  marketing_metrics IS
  'Time-series метрики рекламы (день × канал × кампания × источник). Деньги в МИКРО (₽×1e6). UNIQUE-ключ для апсертов. ТЗ 2026-06-19 (ТАРГЕТ).';
COMMENT ON COLUMN marketing_metrics.cost_micros IS 'Стоимость в МИКРО (как у Яндекс.Директ). UI делит на 1e6.';
COMMENT ON COLUMN marketing_metrics.goal_reaches IS 'Достижения целей Метрики: {"goal_name": count, ...}';

-- ─────── metrika_counters: реестр счётчиков для ETL ───────
CREATE TABLE IF NOT EXISTS metrika_counters (
  counter_id      BIGINT PRIMARY KEY,
  tenant_id       UUID NOT NULL DEFAULT '11111111-2222-3333-4444-555555555555'::uuid,
  site            TEXT NOT NULL,
  label           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE metrika_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY mc_service_all ON metrika_counters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY mc_auth_read   ON metrika_counters FOR SELECT TO authenticated USING (true);

-- Сид от ТАРГЕТА
INSERT INTO metrika_counters (counter_id, tenant_id, site, label, is_active) VALUES
  (109998862, '11111111-2222-3333-4444-555555555555', 'nimbolabs.io',             'Nimbo Agency',  TRUE),
  (109985585, '11111111-2222-3333-4444-555555555555', 'investfreelife.github.io', 'Nimbo лендинги', TRUE)
ON CONFLICT (counter_id) DO UPDATE SET
  site = EXCLUDED.site, label = EXCLUDED.label, is_active = EXCLUDED.is_active;

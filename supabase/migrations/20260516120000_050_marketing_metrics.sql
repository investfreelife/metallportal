-- ТЗ #050 — Marketing metrics table + daily summary view (Epic F3 Phase 1)
--
-- Sergey directive 2026-05-16: «иди по плану, не останавливайся пока всё не сделаешь»
--
-- Storage для unified marketing data: Yandex Metrika / Direct / Webmaster + Voximplant
-- (GA4 deferred — Google restrictions per pulse 2026-05-16 14:30).
--
-- ETL push'ит daily (cron 30 мин через GH Actions). Dashboard /admin/operator
-- читает marketing_daily_summary view с date filter (7d/30d/90d).
--
-- Schema design:
--   - (date, source, channel, metric_name, metric_meta) UNIQUE — upsert-friendly
--   - metric_meta JSONB для dimensions (campaign_id, ad_group, keyword, page_url)
--   - RLS: admin SELECT, service_role write (ETL push)

BEGIN;

CREATE TABLE IF NOT EXISTS marketing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source TEXT NOT NULL,
  channel TEXT,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(14,2) NOT NULL,
  metric_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_metrics_unique_dimension UNIQUE (date, source, channel, metric_name, metric_meta)
);

COMMENT ON TABLE marketing_metrics IS 'ТЗ #050 — unified marketing data store. ETL pushes daily.';
COMMENT ON COLUMN marketing_metrics.source IS 'metrika | yandex_direct | webmaster | voximplant | manual';
COMMENT ON COLUMN marketing_metrics.channel IS 'organic | paid | direct | referral | social | email | phone | NULL';
COMMENT ON COLUMN marketing_metrics.metric_name IS 'visits | leads | spend | clicks | impressions | cpl | ctr | cr | revenue | avg_position | call_count | call_duration_avg | call_missed';
COMMENT ON COLUMN marketing_metrics.metric_meta IS 'JSONB: campaign_id, ad_group, keyword, page_url, query, etc.';

CREATE INDEX IF NOT EXISTS idx_marketing_metrics_date_source ON marketing_metrics(date DESC, source);
CREATE INDEX IF NOT EXISTS idx_marketing_metrics_channel ON marketing_metrics(channel) WHERE channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_metrics_metric ON marketing_metrics(metric_name);

ALTER TABLE marketing_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read marketing_metrics" ON marketing_metrics;
CREATE POLICY "Admin read marketing_metrics" ON marketing_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role write marketing_metrics" ON marketing_metrics;
CREATE POLICY "Service role write marketing_metrics" ON marketing_metrics FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Daily summary view — pre-aggregated для dashboard perf.
-- Dashboard SELECT'ит этот view с WHERE date >= ... ORDER BY date DESC.
CREATE OR REPLACE VIEW marketing_daily_summary AS
SELECT
  date,
  source,
  channel,
  SUM(CASE WHEN metric_name = 'visits' THEN metric_value END) AS visits,
  SUM(CASE WHEN metric_name = 'leads' THEN metric_value END) AS leads,
  SUM(CASE WHEN metric_name = 'spend' THEN metric_value END) AS spend,
  SUM(CASE WHEN metric_name = 'clicks' THEN metric_value END) AS clicks,
  SUM(CASE WHEN metric_name = 'impressions' THEN metric_value END) AS impressions,
  AVG(CASE WHEN metric_name = 'cpl' THEN metric_value END) AS cpl,
  AVG(CASE WHEN metric_name = 'avg_position' THEN metric_value END) AS avg_position,
  SUM(CASE WHEN metric_name = 'revenue' THEN metric_value END) AS revenue,
  SUM(CASE WHEN metric_name = 'call_count' THEN metric_value END) AS call_count,
  AVG(CASE WHEN metric_name = 'call_duration_avg' THEN metric_value END) AS call_duration_avg,
  SUM(CASE WHEN metric_name = 'call_missed' THEN metric_value END) AS call_missed
FROM marketing_metrics
GROUP BY date, source, channel;

COMMENT ON VIEW marketing_daily_summary IS 'ТЗ #050 — pre-aggregated daily metrics для /admin/operator dashboard.';

COMMIT;

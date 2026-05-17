-- 2026-05-17 — Roadmap milestones table
-- Per Sergey directive: «сделай в CRM план с результатами и будем сверять»
--
-- Goal: один источник истины для целей проекта. На CRM dashboard секция
-- «План и результаты» показывает каждый milestone с target / current / progress.
-- Auto-check периодически refresh'ит current_value через CLI/API (similar к sergey_actions).

CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,

  -- Horizon: today / week / month / quarter / year
  horizon TEXT NOT NULL CHECK (horizon IN ('today','week','month','quarter','year')),
  -- For sorting within horizon
  priority INT DEFAULT 50,

  -- Targets
  target_value NUMERIC,
  target_unit TEXT,
  target_label TEXT,  -- Human-readable target (e.g. "100 млн ₽/мес GMV")
  deadline DATE,

  -- Current state
  current_value NUMERIC,
  current_label TEXT,
  progress_percent INT,  -- 0-100, auto-computed where possible

  -- Status: not_started / in_progress / on_track / behind / done / blocked
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','on_track','behind','done','blocked')),

  -- Auto-check (similar к sergey_actions)
  check_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (check_method IN ('manual','sql_query','http_get','yc_address','articles_count','prs_merged','agent_events_count','metrika_visits','metrika_goals','voximplant_balance','none')),
  check_params JSONB DEFAULT '{}',
  check_interval_hours INT DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  last_check_result JSONB,

  -- Owner agent / role
  owner_agent TEXT,  -- 'алексей','иван','юля','павел','sergey' etc.
  owner_role TEXT,

  -- Dependencies (blocks)
  blocks_milestones TEXT[],  -- slugs that this milestone blocks (must complete to unblock)
  blocked_by_milestones TEXT[],

  -- Notes
  notes TEXT,

  -- Auto-managed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX roadmap_milestones_horizon_idx ON roadmap_milestones(horizon, priority);
CREATE INDEX roadmap_milestones_status_idx ON roadmap_milestones(status);
CREATE INDEX roadmap_milestones_deadline_idx ON roadmap_milestones(deadline) WHERE deadline IS NOT NULL;

ALTER TABLE roadmap_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read roadmap_milestones" ON roadmap_milestones FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin update roadmap_milestones" ON roadmap_milestones FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Service role full roadmap_milestones" ON roadmap_milestones FOR ALL TO service_role USING (true);

CREATE TRIGGER roadmap_milestones_updated_at
  BEFORE UPDATE ON roadmap_milestones
  FOR EACH ROW EXECUTE FUNCTION bump_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE roadmap_milestones;

-- ============================================================
-- Seed 25 milestones — current plan
-- ============================================================

INSERT INTO roadmap_milestones (slug, title, description, horizon, priority, target_value, target_unit, target_label, deadline, current_value, current_label, status, check_method, check_params, owner_agent, owner_role, notes) VALUES

-- ====== TIER 1 — TODAY (within 4 hours) ======
('blog-reader-live', 'Blog reader live на /blog', '16 Юлиных статей доступны на /blog/<slug>', 'today', 1, 16, 'articles', '16 статей × HTTP 200', '2026-05-17', 0, '/blog → 404', 'in_progress', 'sql_query', '{"query":"verify_blog_reader_live"}', 'иван', 'backend', 'URGENT_2026-05-17_BLOG_READER_P0.md'),

('alexey-chat-ui-live', 'Алексей chat в CRM dashboard', 'Sergey пишет → Alexey daemon отвечает через CLI', 'today', 2, 1, 'feature', 'Chat виджет + daemon работает', '2026-05-17', 0, 'не построен', 'in_progress', 'sql_query', '{"query":"verify_alexey_chat_messages_table"}', 'павел', 'crm-developer', 'URGENT_2026-05-17_ALEXEY_CHAT_UI.md'),

('vercel-email-spam-zero', 'Vercel/GH email spam = 0', 'metallportal Vercel + yandex_direct ETL fail emails остановлены', 'today', 3, 0, 'emails/day', '0 failure emails', '2026-05-17', 0, 'fixed today', 'done', 'manual', '{}', 'алексей', 'cto', 'vercel.json _comment removed (commit 540169d)'),

-- ====== TIER 2 — THIS WEEK (by 2026-05-24) ======
('articles-26-published', '26 статей опубликовано', 'Wave 1 (16) + Wave 2 marketplace pivot (10 new)', 'week', 1, 26, 'articles', '26 SEO articles live', '2026-05-24', 16, '16 в repo, blog reader pending', 'in_progress', 'articles_count', '{}', 'юля', 'content', 'content-roadmap-q3-2026.md Wave 2'),

('calc-landings-5', '5 калькуляторов на /tools', 'Базовые: арматура / лист / труба / уголок / двутавр-швеллер', 'week', 2, 5, 'pages', '5 calc pages live', '2026-05-24', 0, '0 — briefs готовы', 'not_started', 'http_get', '{"urls":["/tools/calc-vesa-armatury","/tools/calc-vesa-lista","/tools/calc-vesa-truby","/tools/calc-vesa-ugolka","/tools/calc-vesa-dvutavra"]}', 'иван', 'backend', 'Юли 5 calc briefs ready'),

('cross-channel-39', '39 cross-channel adaptations', 'TG + Дзен + VK для 13 articles', 'week', 3, 39, 'files', '39 social posts published', '2026-05-24', 9, '9 done (Wave 1 art 3-5)', 'in_progress', 'sql_query', '{"query":"count_social_adaptations"}', 'юля', 'content', 'DISPATCH_2026-05-17_C_TIER_ADAPTATIONS.md'),

('yandex-direct-api', 'Yandex Direct API approved', 'OAuth approval → ETL pulls campaign data', 'week', 4, 1, 'boolean', 'Active', '2026-05-22', 0, 'pending submit (Sergey)', 'blocked', 'metrika_visits', '{"source":"yandex_direct"}', 'sergey', 'owner', 'manual заявка через direct.yandex.ru'),

('telegram-channel', 'Telegram канал @harlansteel', 'Создан + 1+ post + bot для auto-posting', 'week', 5, 1, 'boolean', '@harlansteel live с posts', '2026-05-24', 0, 'не создан', 'not_started', 'http_get', '{"url":"https://t.me/harlansteel"}', 'sergey', 'owner', '5 min create + Юлины TG-posts auto-publish'),

('fswatch-race-fixed', 'fswatch race investigation closed', 'Pavel report SEV-2 — concurrent edits losing work', 'week', 6, 1, 'boolean', 'Root cause + fix + verified', '2026-05-19', 0, 'investigation queued', 'in_progress', 'sql_query', '{"query":"check_blockers_resolved"}', 'иван', 'backend', 'URGENT_2026-05-17_INVESTIGATE_FSWATCH_RACE.md'),

-- ====== TIER 3 — THIS MONTH (by 2026-06-17) ======
('sellers-onboarded-5', '5 verified поставщиков', 'Manual sales by Sergey + onboarding', 'month', 1, 5, 'sellers', '5+ active sellers', '2026-06-17', 1, '1 (Металлсервис catalog imported)', 'in_progress', 'sql_query', '{"query":"count_active_sellers"}', 'sergey', 'sales', 'Phase 1 critical milestone'),

('first-transactions', 'Первые marketplace transactions', 'End-to-end: RFQ → quote → order → payment → delivery', 'month', 2, 5, 'transactions', '5+ completed orders', '2026-06-17', 0, '0', 'not_started', 'sql_query', '{"query":"count_completed_orders"}', 'sergey', 'sales', 'Validates marketplace economics'),

('articles-40', '40 articles total', 'Wave 2+3 done, начало Wave 4', 'month', 3, 40, 'articles', '40 published articles', '2026-06-17', 16, '16 в repo', 'in_progress', 'articles_count', '{}', 'юля', 'content', 'content-roadmap Wave 2-3'),

('calc-landings-8', '8 калькуляторов всего', 'Base 5 + advanced 3 (нержавейка / wizard / BOM)', 'month', 4, 8, 'pages', '8 calc pages live', '2026-06-17', 0, '0', 'not_started', 'http_get', '{"urls":["/tools/calc-vesa-armatury","/tools/calc-vesa-lista","/tools/calc-vesa-truby","/tools/calc-vesa-ugolka","/tools/calc-vesa-dvutavra","/tools/calc-vesa-nerzhaveiki","/tools/zabor-iz-profilnoy-truby","/tools/specifikatsiya-metallokonstruktsii"]}', 'иван', 'backend', 'Все 8 Юли briefs ready'),

('slo-dashboard-live', 'YC SLO monitoring + alerts', '5 SLOs tracked, alerts → Telegram', 'month', 5, 5, 'slos', '5 active SLO checks', '2026-06-17', 0, 'spec written, impl pending', 'not_started', 'sql_query', '{"query":"check_slo_dashboard_active"}', 'иван', 'backend', 'DISPATCH #051'),

('organic-traffic-1k', 'Organic traffic 1K/мес', 'Wave 1+2 articles indexed by Yandex', 'month', 6, 1000, 'visits/month', '1000+ /blog visits', '2026-06-17', 0, '0 (blog не live)', 'not_started', 'metrika_visits', '{"section":"blog"}', 'юля', 'content', 'After blog reader merge + 2 weeks indexing'),

('schema-org-products', 'Schema.org Product + AggregateOffer', 'Multi-seller offers с Rich snippets', 'month', 7, 1, 'feature', 'Schema на product pages', '2026-06-17', 0, '0', 'not_started', 'http_get', '{"validator":"google-rich-results"}', 'иван', 'backend', 'schema-org-marketplace.md spec ready'),

-- ====== TIER 4 — Q3 2026 (3 месяца, by 2026-08-17) ======
('sellers-30', '30 verified sellers', 'Sales pipeline working', 'quarter', 1, 30, 'sellers', '30+ active sellers', '2026-08-17', 1, '1', 'not_started', 'sql_query', '{"query":"count_active_sellers"}', 'sergey', 'sales', 'Need sales playbook + onboarding automation'),

('gmv-1m', 'GMV первый 1 млн ₽/мес', 'Marketplace economics validated', 'quarter', 2, 1000000, 'rub/month', '1 млн ₽ GMV/мес', '2026-08-17', 0, '0', 'not_started', 'sql_query', '{"query":"sum_orders_amount_last_30_days"}', 'sergey', 'owner', 'Inflection point — funding decision after'),

('articles-60', '60 articles total', 'Все 5 waves contentов', 'quarter', 3, 60, 'articles', '60 SEO articles', '2026-08-17', 16, '16', 'not_started', 'articles_count', '{}', 'юля', 'content', 'Sustained 5 articles/week'),

('organic-traffic-10k', 'Organic traffic 10K/мес', 'Mature SEO foundation', 'quarter', 4, 10000, 'visits/month', '10000+ blog visits', '2026-08-17', 0, '0', 'not_started', 'metrika_visits', '{}', 'юля', 'content', 'Yandex indexes + backlinks'),

('buyers-100', '100 active buyers', 'Repeat customers + new acquisition', 'quarter', 5, 100, 'buyers', '100+ unique buyers/month', '2026-08-17', 0, '0', 'not_started', 'sql_query', '{"query":"count_distinct_buyers_last_30_days"}', 'sergey', 'sales', 'Phase 2 marketing — Я.Direct + organic'),

-- ====== TIER 5 — YEAR (May 2027 — North Star) ======
('gmv-100m', 'GMV 100 млн ₽/мес — North Star', 'Become #1 B2B-marketplace металла РФ', 'year', 1, 100000000, 'rub/month', '100 млн ₽ GMV/мес', '2027-05-17', 0, '0', 'not_started', 'sql_query', '{"query":"sum_orders_amount_last_30_days"}', 'sergey', 'owner', 'North Star из knowledge-base/00_vision.md'),

('sellers-100', '100 verified sellers', '100+ active поставщиков', 'year', 2, 100, 'sellers', '100+ active sellers', '2027-05-17', 1, '1', 'not_started', 'sql_query', '{"query":"count_active_sellers"}', 'sergey', 'sales', 'Vision target'),

('buyers-1000', '1000+ monthly buyers', 'Repeat purchase rate >40%', 'year', 3, 1000, 'buyers/month', '1000+ unique buyers', '2027-05-17', 0, '0', 'not_started', 'sql_query', '{"query":"count_distinct_buyers_last_30_days"}', 'sergey', 'sales', 'Vision target'),

('sku-50k', '50,000 SKU мulti-supplier', 'Coverage всего металлопрокат рынка РФ', 'year', 4, 50000, 'skus', '50K+ SKUs', '2027-05-17', 12166, '12166 (single supplier)', 'not_started', 'sql_query', '{"query":"count_products"}', 'иван', 'data', 'Need bulk supplier onboarding'),

('mrr-3m', 'MRR 2-3 млн ₽/мес', 'Take rate × GMV revenue для Sergey', 'year', 5, 3000000, 'rub/month', '2-3 млн ₽/мес revenue', '2027-05-17', 0, '0', 'not_started', 'sql_query', '{"query":"sum_marketplace_commission_last_30_days"}', 'sergey', 'owner', '~2.5% take rate × 100М GMV');

-- Auto-check function via cron (will be implemented in scripts/check_milestones.sh)

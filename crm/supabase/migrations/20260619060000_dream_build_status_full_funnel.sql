-- Sergey directive 2026-06-18: расширить build_status до полной воронки
-- production → продажи. Канбан /dream/kanban.

ALTER TABLE dream_leads DROP CONSTRAINT IF EXISTS dream_leads_build_status_check;

-- Новый набор состояний:
--   parsed         — спарсен, ничего не сделано
--   enriching      — агент-проверщик enrich-ит (Bright Data, фото, услуги, отзывы)
--   plan_proposed  — агент собрал build_plan, ждёт Sergey
--   approved       — Sergey утвердил план → агент-кодер ставит в очередь
--   building       — агент-кодер сейчас собирает сайт
--   built          — сайт сделан, есть запись в dream_landings
--   review_built   — Sergey смотрит готовый сайт, может оставить замечания
--   for_sale       — Sergey утвердил для продажи (chosen на лендинге)
--   selling        — агент-продавец делает outreach
--   sold           — продано
--   lost           — отказ клиента
--   trash          — мусор (есть свой сайт, закрыты, дубль) — НЕ удаляется,
--                    можно вернуть кнопкой «всё равно делать сайт»
ALTER TABLE dream_leads ADD CONSTRAINT dream_leads_build_status_check
  CHECK (build_status IN (
    'parsed','enriching','plan_proposed','approved','building','built',
    'review_built','for_sale','selling','sold','lost','trash'
  ));

CREATE INDEX IF NOT EXISTS idx_dream_leads_build_funnel ON dream_leads(build_status, updated_at DESC);

-- Журнал переходов — кто и когда что переключал
CREATE TABLE IF NOT EXISTS dream_lead_transitions (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES dream_leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,        -- 'stolica' / 'agent:parser' / 'agent:coder' / 'agent:seller'
  reason TEXT,                -- опц. — почему перевёл (для override блокера и т.д.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dream_transitions_lead ON dream_lead_transitions(lead_id, created_at DESC);

ALTER TABLE dream_lead_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dlt_service_all ON dream_lead_transitions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dlt_auth_read   ON dream_lead_transitions FOR SELECT TO authenticated USING (true);

COMMENT ON COLUMN dream_leads.build_status IS
  'parsed → enriching → plan_proposed → approved → building → built → review_built → for_sale → selling → sold/lost. trash = мусор с правом вернуть.';

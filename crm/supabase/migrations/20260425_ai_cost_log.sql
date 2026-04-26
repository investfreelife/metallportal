-- Детальный лог каждого LLM запроса агентов harlan-ai
CREATE TABLE IF NOT EXISTS ai_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',

  -- Кто и что
  agent_name TEXT NOT NULL,        -- bezos, seller, smm, analyst, scout
  task_name TEXT NOT NULL,         -- "Утренний цикл", "Скоринг лида", "Генерация КП"
  task_description TEXT,           -- краткое описание что делал

  -- Модель
  model TEXT NOT NULL,             -- anthropic/claude-sonnet-4-6
  model_short TEXT,                -- sonnet-4, gpt-4o-mini

  -- Токены
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Стоимость в USD
  input_cost_usd DECIMAL(10,6) DEFAULT 0,
  output_cost_usd DECIMAL(10,6) DEFAULT 0,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,

  -- Результат
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER,

  -- Связи
  contact_id UUID,
  deal_id UUID,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_cost_log" ON ai_cost_log FOR ALL USING (tenant_id = get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_tenant ON ai_cost_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_agent ON ai_cost_log(tenant_id, agent_name, created_at DESC);

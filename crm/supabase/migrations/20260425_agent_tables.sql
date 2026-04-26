-- ============================================================
-- Agent tables: agent_cycles + фиксы для agent_actions и ai_queue
-- Безопасно запускать повторно — все команды идемпотентны
-- ============================================================

-- 1. AGENT_CYCLES — отсутствующая таблица (нужна для /bezos страницы)
CREATE TABLE IF NOT EXISTS agent_cycles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  agent_name   TEXT NOT NULL,
  cycle_type   TEXT DEFAULT 'scheduled',
  status       TEXT DEFAULT 'completed',
  actions_taken INTEGER DEFAULT 0,
  started_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE agent_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON agent_cycles;
CREATE POLICY "service_role_all" ON agent_cycles FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_agent_cycles_tenant ON agent_cycles(tenant_id, started_at DESC);

-- 2. AGENT_ACTIONS — добавить колонку success BOOLEAN (сейчас есть status TEXT)
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;
UPDATE agent_actions SET success = (status = 'success') WHERE success IS NULL;

-- 3. AI_QUEUE — добавить updated_at (нужна для /api/queue/update)
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. AGENT_MEMORY — снять ограничение на memory_type (агент может писать любые типы)
ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_memory_type_check;

-- 5. AGENT_MEMORY — убедиться что таблица создана (на случай если ai_tables.sql не запускали)
CREATE TABLE IF NOT EXISTS agent_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  agent_name   TEXT NOT NULL,
  memory_type  TEXT NOT NULL,
  content      TEXT NOT NULL,
  importance   INTEGER DEFAULT 5,
  tags         TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON agent_memory;
CREATE POLICY "service_role_all" ON agent_memory FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant  ON agent_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent   ON agent_memory(tenant_id, agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_memory_import  ON agent_memory(tenant_id, agent_name, importance DESC);

-- 6. AGENT_ACTIONS — убедиться что таблица создана
CREATE TABLE IF NOT EXISTS agent_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  agent_name   TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  input_data   JSONB DEFAULT '{}',
  output_data  JSONB DEFAULT '{}',
  action_input JSONB DEFAULT '{}',
  action_output TEXT,
  duration_ms  INTEGER,
  success      BOOLEAN DEFAULT true,
  status       TEXT DEFAULT 'success',
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON agent_actions;
CREATE POLICY "service_role_all" ON agent_actions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_agent_actions_tenant ON agent_actions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent  ON agent_actions(tenant_id, agent_name, created_at DESC);

-- Проверка
SELECT tablename,
  CASE WHEN rowsecurity THEN '✅ RLS' ELSE '❌ NO RLS' END AS rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('agent_memory', 'agent_actions', 'agent_cycles')
ORDER BY tablename;

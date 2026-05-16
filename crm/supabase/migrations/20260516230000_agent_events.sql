-- agent_events — orchestration team activity feed
--
-- Контекст: 2026-05-16 DISPATCH OPERATOR_TO_CRM (Pavel + Алексей).
-- Sergey directive «это должно быть в срм!» — orchestration pulse.md +
-- auto_checkpoint commits отправляются в эту таблицу, на CRM dashboard
-- видим единый стрим «кто что делает» в realtime (Supabase Realtime channel).
--
-- Каждый agent_init.sh / agent_report.sh / auto_checkpoint.sh POST'ит
-- событие в /api/agent-events с X-Agent-Token (env AGENT_WEBHOOK_TOKEN).
-- TeamActivityFeed.tsx subscribe'ится на INSERT для realtime UI.

CREATE TABLE IF NOT EXISTS agent_events (
  id BIGSERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,           -- 'иван' / 'юля' / 'антон' / 'катя' / 'алексей' / 'павел' / 'михаил' / 'никита'
  event_type TEXT NOT NULL,            -- 'pulse' / 'commit' / 'report' / 'task_start' / 'task_end' / 'blocked'
  message TEXT NOT NULL,               -- human-readable, 1-2 sentences
  task_id TEXT,                        -- optional reference
  commit_sha TEXT,                     -- optional reference
  severity TEXT DEFAULT 'info',        -- 'info' / 'warn' / 'critical'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_events_agent_created_idx ON agent_events(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_events_created_idx ON agent_events(created_at DESC);
CREATE INDEX IF NOT EXISTS agent_events_event_type_idx ON agent_events(event_type, created_at DESC);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

-- Service role bypass — webhook + dashboard server reads через service_role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_events' AND policyname = 'service_role_all_agent_events') THEN
    CREATE POLICY "service_role_all_agent_events" ON agent_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Authenticated read (CRM browser client subscribes на realtime channel)
-- Tenant-scoped не делаем — orchestration global для всех admin CRM users.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_events' AND policyname = 'authenticated_read_agent_events') THEN
    CREATE POLICY "authenticated_read_agent_events" ON agent_events
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Enable realtime (Supabase Realtime publication)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agent_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- supabase_realtime publication missing (local / non-Supabase env) — skip
  NULL;
END $$;

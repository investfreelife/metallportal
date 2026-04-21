-- Migration 001: Phase 2-3 additions
-- Run in Supabase SQL Editor

-- ai_queue: add missing columns
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS suggested_message TEXT;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE ai_queue ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- ai_queue: extend action_type CHECK (drop + re-add)
ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_action_type_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_action_type_check
  CHECK (action_type IN (
    'send_email', 'send_message', 'make_call', 'call',
    'send_proposal', 'create_task', 'update_stage',
    'send_campaign', 'schedule'
  ));

-- ai_queue: extend priority CHECK
ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_priority_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_priority_check
  CHECK (priority IN ('urgent', 'high', 'medium', 'normal', 'low'));

-- ai_queue: extend status CHECK
ALTER TABLE ai_queue DROP CONSTRAINT IF EXISTS ai_queue_status_check;
ALTER TABLE ai_queue ADD CONSTRAINT ai_queue_status_check
  CHECK (status IN (
    'pending', 'approved', 'rejected', 'executed',
    'auto_executed', 'snoozed'
  ));

-- contacts: add missing columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- activities: add metadata column
ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

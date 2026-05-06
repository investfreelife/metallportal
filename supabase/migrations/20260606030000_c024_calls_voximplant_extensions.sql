-- c024: extend existing `calls` table for Voximplant webhook ingestion +
-- recording lifecycle. Existing schema (created 2026-04-24) already has
-- recording_url / transcript / ai_* fields. We add:
--   - voximplant_call_id    UNIQUE (webhook idempotency на retry)
--   - voximplant_session_id (traceback к Voximplant log session URL)
--   - forwarded_to          (для inbound forwards — куда переадресовали)
--   - status CHECK extended ('pending_transcription' / 'transcribed')
--   - call_access_log table (LAW-contact-privacy §4: audit recording listens)
--
-- LAW-contact-privacy note: phone numbers stored plaintext в `calls.from_number` /
-- `to_number` per existing schema — encryption deferred к follow-up migration.
-- RLS already enforced on `calls` (tenant_isolation policy).

BEGIN;

-- ── 1. Voximplant tracking columns ─────────────────────────────────────
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS voximplant_call_id    TEXT,
  ADD COLUMN IF NOT EXISTS voximplant_session_id TEXT,
  ADD COLUMN IF NOT EXISTS forwarded_to          TEXT;

-- Idempotency: same Voximplant call_id won't INSERT twice.
-- Full UNIQUE constraint (NOT partial index) — PostgreSQL allows multiple
-- NULL values in UNIQUE constraints by default, so legacy rows w/o
-- voximplant_call_id не collide. ON CONFLICT (voximplant_call_id) requires
-- a real UNIQUE constraint (партial index не работает).
ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_voximplant_call_id_key;
ALTER TABLE public.calls
  ADD CONSTRAINT calls_voximplant_call_id_key UNIQUE (voximplant_call_id);

CREATE INDEX IF NOT EXISTS idx_calls_voximplant_session
  ON public.calls (voximplant_session_id)
  WHERE voximplant_session_id IS NOT NULL;

-- ── 2. status CHECK constraint — extend ────────────────────────────────
ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_status_check;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_status_check CHECK (
    status = ANY (ARRAY[
      'initiated', 'ringing', 'answered', 'completed', 'missed', 'failed',
      'pending_transcription',  -- c024: webhook arrived, recording url есть, transcript not yet
      'transcribed',            -- c015: Whisper finished
      'analyzed'                -- c015: AI analysis finished
    ])
  );

-- ── 3. Audit log per LAW-contact-privacy §4 ────────────────────────────
-- Logs WHO listened to WHICH recording / viewed transcript. Admin-only access
-- via `calls` table — this log is staff/admin only and tracks every read.
CREATE TABLE IF NOT EXISTS public.call_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,                   -- copied from calls.tenant_id; isolation key
  call_id       UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  accessed_by   UUID,                            -- admin_users.id (CRM session user)
  access_type   TEXT NOT NULL CHECK (access_type IN (
                  'list_view', 'detail_view',
                  'recording_listened', 'transcript_viewed',
                  'recording_downloaded'
                )),
  ip_address    INET,
  user_agent    TEXT,
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_access_log_call_id
  ON public.call_access_log (call_id);
CREATE INDEX IF NOT EXISTS idx_call_access_log_accessed_at
  ON public.call_access_log (accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_access_log_accessed_by
  ON public.call_access_log (accessed_by, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_access_log_tenant
  ON public.call_access_log (tenant_id, accessed_at DESC);

ALTER TABLE public.call_access_log ENABLE ROW LEVEL SECURITY;

-- Tenant isolation matches existing `calls` policy. Service-role bypasses
-- RLS for webhook + sync writes; user-facing reads enforced via tenant_id.
DROP POLICY IF EXISTS "tenant_isolation" ON public.call_access_log;
CREATE POLICY "tenant_isolation"
  ON public.call_access_log
  FOR ALL
  USING (tenant_id = get_tenant_id());

COMMIT;

-- Post-migration verify:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='calls' AND column_name IN ('voximplant_call_id','voximplant_session_id','forwarded_to');
-- → 3 rows
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conname='calls_status_check';
-- → must contain 'pending_transcription'
--
-- SELECT count(*) FROM information_schema.tables
--  WHERE table_name='call_access_log' AND table_schema='public';
-- → 1

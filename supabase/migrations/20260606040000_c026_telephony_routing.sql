-- c026: smart routing для inbound звонков + audit log переадресаций.
--
-- Existing schema (verified 2026-05-06):
--   - contacts.assigned_to UUID FK → crm_users(id) — но crm_users пустой
--   - CRM auth uses admin_users.id (different table, populated)
--   - Multi-tenant via contacts.tenant_id (canonical TENANT_ID)
--
-- Решение: manager_extensions.user_id — UUID без FK constraint (loose),
-- references admin_users.id фактически. Routing использует
-- contacts.assigned_to (если заполнено) → manager_extensions.user_id matching.
-- Pre-launch (1 manager = Sergey) — все calls идут к нему через
-- is_primary_fallback=true.

BEGIN;

-- ── 1. Manager extensions: phone mapping per CRM user ─────────────────
CREATE TABLE IF NOT EXISTS public.manager_extensions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID,                          -- admin_users.id (loose FK)
  phone_e164          TEXT NOT NULL,                 -- '+79013617775'
  display_name        TEXT,                          -- 'Сергей' / 'Иван П.'
  status              TEXT NOT NULL DEFAULT 'available'
                      CHECK (status IN ('available', 'busy', 'offline')),
  is_primary_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One manager_extension per (tenant, user) — partial для NULL user_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_manager_ext_tenant_user
  ON public.manager_extensions (tenant_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manager_ext_tenant_status
  ON public.manager_extensions (tenant_id, status);

-- Single primary fallback per tenant (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_manager_ext_primary
  ON public.manager_extensions (tenant_id)
  WHERE is_primary_fallback = true;

ALTER TABLE public.manager_extensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.manager_extensions;
CREATE POLICY "tenant_isolation"
  ON public.manager_extensions
  FOR ALL
  USING (tenant_id = get_tenant_id());

-- ── 2. Manager groups (round-robin / parallel ringing) ────────────────
CREATE TABLE IF NOT EXISTS public.manager_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            TEXT NOT NULL,                  -- 'sales', 'support', 'default'
  algorithm       TEXT NOT NULL DEFAULT 'round_robin'
                  CHECK (algorithm IN ('round_robin', 'parallel', 'longest_idle')),
  member_user_ids UUID[] NOT NULL DEFAULT '{}',
  next_round_robin_idx INT NOT NULL DEFAULT 0,    -- pointer для round_robin algo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.manager_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.manager_groups;
CREATE POLICY "tenant_isolation"
  ON public.manager_groups
  FOR ALL
  USING (tenant_id = get_tenant_id());

-- ── 3. Routing log — audit per inbound call routing decision ──────────
CREATE TABLE IF NOT EXISTS public.call_routing_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  voximplant_call_id TEXT,
  voximplant_session_id TEXT,
  caller_phone       TEXT,                        -- plaintext per existing schema
  matched_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  routed_to_user_id  UUID,                        -- admin_users.id (loose)
  routed_to_phone    TEXT NOT NULL,               -- actual forward target (audit)
  routing_reason     TEXT NOT NULL CHECK (routing_reason IN (
                       'assigned_manager',     -- contact.assigned_to → его phone
                       'assigned_manager_busy_fallback',
                       'group_round_robin',
                       'group_parallel',
                       'fallback_primary',     -- is_primary_fallback=true
                       'no_match_default',     -- no contact + no group
                       'manager_transfer'      -- mid-call transfer
                     )),
  routed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_routing_tenant_at
  ON public.call_routing_log (tenant_id, routed_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_routing_voximplant
  ON public.call_routing_log (voximplant_call_id);
CREATE INDEX IF NOT EXISTS idx_call_routing_contact
  ON public.call_routing_log (matched_contact_id);

ALTER TABLE public.call_routing_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.call_routing_log;
CREATE POLICY "tenant_isolation"
  ON public.call_routing_log
  FOR ALL
  USING (tenant_id = get_tenant_id());

-- ── 4. Pending transfer state — для mid-call transfer ─────────────────
-- Mid-call transfer работает via flag-driven scenario re-routing:
-- 1. Manager A clicks Transfer → CRM sets row here с target phone
-- 2. CRM hangs up Manager A's leg via Voximplant Calls/Disconnect API
-- 3. Scenario detects manager leg disconnect, reads pending transfer flag
--    via /api/voximplant/transfer-pending, calls new manager
-- 4. Caller hears brief silence, bridged with new manager
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS pending_transfer_phone TEXT,
  ADD COLUMN IF NOT EXISTS pending_transfer_user_id UUID,
  ADD COLUMN IF NOT EXISTS pending_transfer_initiated_by UUID,
  ADD COLUMN IF NOT EXISTS pending_transfer_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_calls_pending_transfer
  ON public.calls (voximplant_session_id)
  WHERE pending_transfer_phone IS NOT NULL;

-- ── 5. Seed: Sergey как primary fallback ──────────────────────────────
-- Idempotent — не перезаписывает existing если уже seeded.
INSERT INTO public.manager_extensions (
  tenant_id, phone_e164, display_name, is_primary_fallback, status
)
SELECT
  'a1000000-0000-0000-0000-000000000001'::uuid,
  '+79013617775',
  'Сергей',
  true,
  'available'
WHERE NOT EXISTS (
  SELECT 1 FROM public.manager_extensions
   WHERE tenant_id = 'a1000000-0000-0000-0000-000000000001'::uuid
     AND is_primary_fallback = true
);

-- Seed default group
INSERT INTO public.manager_groups (tenant_id, name, algorithm, member_user_ids)
SELECT
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'default',
  'parallel',
  ARRAY[]::uuid[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.manager_groups
   WHERE tenant_id = 'a1000000-0000-0000-0000-000000000001'::uuid
     AND name = 'default'
);

COMMIT;

-- Post-migration verify:
-- SELECT count(*) FROM manager_extensions WHERE is_primary_fallback;  -- 1
-- SELECT count(*) FROM manager_groups WHERE name='default';           -- 1
-- SELECT phone_e164, display_name FROM manager_extensions WHERE is_primary_fallback;
-- → '+79013617775', 'Сергей'

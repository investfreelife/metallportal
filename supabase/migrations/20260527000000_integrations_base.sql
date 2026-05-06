-- n004 Block 1: Base schema для admin/integrations OAuth flow.
--
-- 2 таблицы:
--   integrations          — connected providers per admin/staff user
--   integration_oauth_states — temporary state tokens для CSRF protection в OAuth
--                              redirect dance (TTL 10 min, cleaned up периодически)
--
-- Encryption: access_token_encrypted/refresh_token_encrypted — bytea
-- pgcrypto pgp_sym_encrypt/decrypt с master key из env INTEGRATION_ENCRYPTION_KEY
-- (см. lib/integrations/_encryption.ts).

-- pgcrypto уже enabled (v1.3) — verified в recon.

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'yandex_direct' | 'yandex_metrika' | 'yandex_maps' | 'yandex_zen' | 'vk' |
  -- 'telegram_bot' | 'voximplant' и т.д. White-list задаётся в lib/integrations/_providers.ts
  provider text NOT NULL,
  -- pending  — в процессе OAuth flow (state generated, ждём callback)
  -- connected — active, tokens valid
  -- expired  — refresh failed, требует reconnect
  -- revoked  — admin отключил (или provider revoked)
  -- error    — last_error populated, требует ручной диагностики
  status text NOT NULL DEFAULT 'pending',
  access_token_encrypted bytea,
  refresh_token_encrypted bytea,
  expires_at timestamptz,
  scopes text[],
  -- Provider-specific data: account ID, channel name, bot username, etc.
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz DEFAULT now() NOT NULL,
  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  -- Один user может иметь только одну integration per provider (новая reconnect — UPDATE)
  UNIQUE (provider, connected_by)
);

CREATE INDEX IF NOT EXISTS integrations_provider_idx ON integrations(provider);
CREATE INDEX IF NOT EXISTS integrations_status_idx ON integrations(status);

CREATE TABLE IF NOT EXISTS integration_oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS integration_oauth_states_expires_idx
  ON integration_oauth_states(expires_at);

-- RLS: только admin/staff видят и могут менять integrations.
-- profiles.role text-column (не enum), values: 'user' | 'admin' | 'staff' | 'designer'.
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrations_admin_only ON integrations;
CREATE POLICY integrations_admin_only ON integrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS oauth_states_admin_only ON integration_oauth_states;
CREATE POLICY oauth_states_admin_only ON integration_oauth_states
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
  );

-- Cleanup helper: удалить expired OAuth states (10-min TTL).
-- Вызывать через cron job или ручную команду — defer для следующего этапа.
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS integer
LANGUAGE sql
AS $$
  WITH deleted AS (
    DELETE FROM integration_oauth_states WHERE expires_at < now() RETURNING 1
  )
  SELECT count(*)::integer FROM deleted;
$$;

-- Verify (manual after apply):
--   SELECT extname, extversion FROM pg_extension WHERE extname='pgcrypto';
--     → pgcrypto 1.3 ✅
--   SELECT pgp_sym_encrypt('test', 'master_key') IS NOT NULL;  → true

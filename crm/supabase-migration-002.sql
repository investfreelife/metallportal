-- =====================
-- MIGRATION 002
-- tenant_settings: хранит API ключи, токены и настройки в БД (редактируются из UI)
-- admin_users: добавляем invite flow + telegram
-- =====================

CREATE TABLE IF NOT EXISTS tenant_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)
);

-- Колонки для invite flow в admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Индексы
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_invite_token ON admin_users(invite_token);

-- RLS: только сервисный ключ (управляем через API)
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON tenant_settings USING (false);

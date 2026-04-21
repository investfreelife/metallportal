CREATE TABLE IF NOT EXISTS telegram_auth_codes (
  code TEXT PRIMARY KEY,
  telegram_id BIGINT,
  user_name TEXT,
  confirmed BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Автоочистка истёкших кодов
CREATE INDEX IF NOT EXISTS idx_tg_auth_codes_expires ON telegram_auth_codes(expires_at);

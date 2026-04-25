-- ============================================================
-- site_users — пользователи личного кабинета harlansteel.ru
-- Запустить в Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS site_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL DEFAULT 'a1000000-0000-0000-0000-000000000001',
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  full_name       TEXT,
  company_name    TEXT,
  inn             TEXT,
  password_hash   TEXT,
  ref_code        TEXT UNIQUE,
  referred_by     UUID REFERENCES site_users(id),
  total_orders    INTEGER DEFAULT 0,
  total_amount    DECIMAL(12,2) DEFAULT 0,
  email_verified  BOOLEAN DEFAULT false,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE site_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON site_users;
CREATE POLICY "service_role_all" ON site_users FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_site_users_tenant   ON site_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_users_email    ON site_users(email);
CREATE INDEX IF NOT EXISTS idx_site_users_ref_code ON site_users(ref_code);
CREATE INDEX IF NOT EXISTS idx_site_users_referred ON site_users(referred_by);

-- Проверка
SELECT count(*) as site_users_created FROM site_users;

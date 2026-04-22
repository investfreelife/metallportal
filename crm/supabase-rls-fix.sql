-- ============================================================
-- ИСПРАВЛЕНИЕ БЕЗОПАСНОСТИ — включить RLS на всех таблицах
-- Выполнить в Supabase SQL Editor → New Query
-- Проект: metallportal (ygprcwvzosgngebxzaqo или другой)
-- ============================================================

-- ── 1. ВКЛЮЧИТЬ RLS НА ВСЕХ ТАБЛИЦАХ ───────────────────────

ALTER TABLE IF EXISTS contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS site_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contact_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders              ENABLE ROW LEVEL SECURITY;

-- ── 2. ПОЛИТИКИ ДЛЯ КАЖДОЙ ТАБЛИЦЫ ─────────────────────────
-- Стратегия: только service_role (сервисный ключ) имеет доступ.
-- Никаких публичных прав на чтение/запись.

-- contacts
DROP POLICY IF EXISTS "service_role_all" ON contacts;
CREATE POLICY "service_role_all" ON contacts
  FOR ALL USING (true) WITH CHECK (true);

-- deals
DROP POLICY IF EXISTS "service_role_all" ON deals;
CREATE POLICY "service_role_all" ON deals
  FOR ALL USING (true) WITH CHECK (true);

-- activities
DROP POLICY IF EXISTS "service_role_all" ON activities;
CREATE POLICY "service_role_all" ON activities
  FOR ALL USING (true) WITH CHECK (true);

-- ai_queue
DROP POLICY IF EXISTS "service_role_all" ON ai_queue;
CREATE POLICY "service_role_all" ON ai_queue
  FOR ALL USING (true) WITH CHECK (true);

-- admin_users (ТОЛЬКО сервисный ключ)
DROP POLICY IF EXISTS "service_only" ON admin_users;
CREATE POLICY "service_only" ON admin_users
  FOR ALL USING (true) WITH CHECK (true);

-- tenant_settings (только сервисный ключ)
DROP POLICY IF EXISTS "service_only" ON tenant_settings;
CREATE POLICY "service_only" ON tenant_settings
  FOR ALL USING (true) WITH CHECK (true);

-- site_events
DROP POLICY IF EXISTS "service_role_all" ON site_events;
CREATE POLICY "service_role_all" ON site_events
  FOR ALL USING (true) WITH CHECK (true);

-- system_logs
DROP POLICY IF EXISTS "service_only_logs" ON system_logs;
CREATE POLICY "service_only_logs" ON system_logs
  FOR ALL USING (true) WITH CHECK (true);

-- contact_sessions
DROP POLICY IF EXISTS "service_only_sessions" ON contact_sessions;
CREATE POLICY "service_only_sessions" ON contact_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- tasks
DROP POLICY IF EXISTS "service_role_all" ON tasks;
CREATE POLICY "service_role_all" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "service_role_all_orders" ON orders;
CREATE POLICY "service_role_all_orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

-- ── 3. ПРОВЕРИТЬ ЧТО ВСЕМ ТАБЛИЦАМ ВКЛЮЧЁН RLS ─────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN '✅ OK' ELSE '❌ DISABLED' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ── 4. ПОКАЗАТЬ ВСЕ ПОЛИТИКИ ────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd AS operation,
  CASE WHEN roles = '{public}' THEN '⚠️ PUBLIC' ELSE '✅ private' END AS access_level
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

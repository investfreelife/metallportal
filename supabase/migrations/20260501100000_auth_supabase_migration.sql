-- =============================================================
-- Auth Supabase migration — Wave 0 / P0-3
-- Replaces admin_users + site_users (custom auth) with
-- auth.users + public.profiles (Supabase Auth canonical pattern).
--
-- Pre-flight (Sergey-side):
--   1. Email/password provider enabled in Auth → Providers
--   2. Two users invited via Auth → Users:
--      - 3e1c18b1-bad7-42c2-b3aa-8d9108f83a66 (Sergey, 7909885@mail.ru)
--      - 1366d56e-2cfd-410b-9b61-af621e0530fb (Designer, kyrochkinak@mail.ru)
--
-- This migration:
--   1. Archives admin_users + site_users (preserved ≥ 7 days, dropped
--      in separate follow-up sub-migration)
--   2. Extends profiles.role CHECK to include admin/designer/manager
--   3. Adds telegram_chat_id column (per ТЗ schema)
--   4. Inserts profile rows for the two pre-registered users
--
-- RLS policies for profiles are NOT defined here — they are set in
-- 20260501000000_rls_rewrite.sql (owner-private via auth.uid() = id).
-- This migration runs AFTER the RLS rewrite (timestamp ordering); the
-- INSERT below uses service_role (db push) so RLS doesn't apply.
--
-- Date: 2026-05-01
-- =============================================================

BEGIN;

-- 1. Backup tables before retiring System A (will be DROP'd 7+ days later)
CREATE TABLE IF NOT EXISTS admin_users_archive_20260501 AS
  SELECT * FROM public.admin_users;

CREATE TABLE IF NOT EXISTS site_users_archive_20260501 AS
  SELECT * FROM public.site_users;

-- 2. Extend profiles.role CHECK to support admin roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'designer', 'manager', 'user', 'buyer', 'supplier'));

-- 3. Add telegram_chat_id column if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- 4. Update default role to 'user' (was 'buyer'; non-breaking — no rows yet)
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';

-- 5. Create profile rows for the two pre-registered Supabase Auth users
INSERT INTO public.profiles (id, role, full_name)
VALUES
  ('3e1c18b1-bad7-42c2-b3aa-8d9108f83a66', 'admin',    'Sergey'),
  ('1366d56e-2cfd-410b-9b61-af621e0530fb', 'designer', 'Designer')
ON CONFLICT (id) DO UPDATE
  SET role      = EXCLUDED.role,
      full_name = EXCLUDED.full_name;

COMMIT;

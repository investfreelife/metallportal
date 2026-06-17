-- Sergey directive 2026-06-17 (вариант B глубокая интеграция):
-- Superadmin может переключать tenant прямо в Sidebar — больше не нужны
-- разные логины для разных тенантов.

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Sergey'у даём superadmin на основном логине 'stolica'. После релогина
-- его session.is_superadmin = true → в Sidebar появится tenant switcher.
UPDATE admin_users SET is_superadmin = TRUE
WHERE login IN ('stolica', 'admin');

-- Index не нужен — таблица admin_users маленькая.

COMMENT ON COLUMN admin_users.is_superadmin IS
  'Если TRUE → пользователь может переключаться между tenants через /api/auth/switch-tenant. Кладётся в JWT при логине.';

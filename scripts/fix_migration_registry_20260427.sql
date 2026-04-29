-- fix_migration_registry_20260427.sql
-- Починка реестра миграций: кривая запись 20260504 → 14-значные версии.
-- Применять через: npx supabase db query --linked -f scripts/fix_migration_registry_20260427.sql

BEGIN;

-- 1. Текущая кривая запись с version='20260504' и name='2_supplier_uploads_align'
--    → меняем версию на 14-значную и фиксим имя
UPDATE supabase_migrations.schema_migrations
   SET version = '20260504000200',
       name    = 'supplier_uploads_align'
 WHERE version = '20260504';

-- 2. Регистрируем "ретроактивно" pricing_v2 (он реально применён, но в реестре отсутствовал)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260504000000', 'supplier_pricing_v2', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- 3. matcher_columns: версия 20260505 → 20260505000000
UPDATE supabase_migrations.schema_migrations
   SET version = '20260505000000'
 WHERE version = '20260505' AND name = 'matcher_columns';

-- 4. Контроль
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260%'
ORDER BY version;

COMMIT;

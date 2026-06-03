-- Восстанавливаем FK admin_users.tenant_id → tenants.id.
-- Без неё PostgREST не строит embedded JOIN `tenants(name, industry)`,
-- который использует `crm/src/app/api/auth/login/route.ts` для
-- получения industry/tenant_name при логине.
--
-- Symptom без FK: login возвращает 401 Неверный логин или пароль
-- (PostgREST шлёт error PGRST200, supabase-js .single() даёт null data,
--  логин-роут не отличает «нет user» от «нет relationship»).

alter table public.admin_users
  drop constraint if exists admin_users_tenant_id_fkey;

alter table public.admin_users
  add constraint admin_users_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

-- Сразу скажем PostgREST перечитать схему (для prod через Mgmt API
-- эта же команда отправлена; здесь — на случай локального supabase db reset).
notify pgrst, 'reload schema';

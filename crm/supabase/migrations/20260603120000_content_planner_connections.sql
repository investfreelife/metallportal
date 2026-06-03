-- Content planner — связь между CRM и платформами публикации (Telegram/VK).
-- Sergey directive 2026-06-03: своя замена облака Postiz, данные у нас.
-- Каждый tenant держит набор подключений (один tenant — несколько каналов/групп).

create table if not exists public.connections (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  platform    text not null check (platform in ('telegram','vk')),
  label       text not null,                 -- человекочитаемое имя «Таксопарк СТОЛИЦА — Telegram канал»
  token       text not null,                 -- bot token (TG) / access_token (VK) — секрет, НЕ возвращать клиенту в открытом виде
  target_id   text not null,                 -- chat_id/@username канала (TG) или group_id (VK)
  enabled     boolean not null default true,
  meta        jsonb,                         -- {check_info, last_checked_at, last_error}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists connections_tenant_platform_idx
  on public.connections (tenant_id, platform);

-- RLS: только service_role (CRM admin) — клиент через anon key читать токены НЕ должен.
alter table public.connections enable row level security;

-- Дроп старых policy при rerun
drop policy if exists "connections service role full" on public.connections;
create policy "connections service role full"
  on public.connections
  for all
  to service_role
  using (true)
  with check (true);

-- ── content_posts: добавим updated_at триггер если ещё нет ─────────
create or replace function public._set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public._set_updated_at();

drop trigger if exists content_posts_set_updated_at on public.content_posts;
create trigger content_posts_set_updated_at
  before update on public.content_posts
  for each row execute function public._set_updated_at();

-- ── Storage bucket для фото постов ────────────────────────────────
-- bucket 'content' = public read (картинки идут в Telegram/VK по URL),
-- write — только service_role через CRM API. Создаётся через UI/API
-- если ещё нет; здесь делаем idempotent insert.
insert into storage.buckets (id, name, public)
  values ('content', 'content', true)
on conflict (id) do nothing;

-- RLS на storage.objects для bucket=content:
-- Anyone may read (public bucket). Insert/Update/Delete — только service_role.
drop policy if exists "content bucket public read" on storage.objects;
create policy "content bucket public read"
  on storage.objects for select
  using (bucket_id = 'content');

drop policy if exists "content bucket service write" on storage.objects;
create policy "content bucket service write"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'content');

drop policy if exists "content bucket service update" on storage.objects;
create policy "content bucket service update"
  on storage.objects for update
  to service_role
  using (bucket_id = 'content');

drop policy if exists "content bucket service delete" on storage.objects;
create policy "content bucket service delete"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'content');

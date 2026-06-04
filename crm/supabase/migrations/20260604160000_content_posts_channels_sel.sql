-- Sergey directive 2026-06-04: «каналы галочками» в редакторе поста.
-- Раньше channel хранился одной строкой (телефон-стайл «telegram» или
-- «любая Telegram-связь»). Теперь — массив из {'telegram','vk'}, можно
-- выбрать оба = публикация в обе соцсети.
--
-- Default ['telegram','vk'] — по умолчанию шлём в оба канала, чтобы
-- старые посты не остались без целей.

alter table public.content_posts
  add column if not exists channels_sel jsonb not null default '["telegram","vk"]'::jsonb;

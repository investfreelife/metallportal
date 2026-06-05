-- Task 050 (taksopark-machine, sergey-coder): добавляем поля расписания/публикации
-- в ad_variants — чтобы Маркетинг-планировщик был полной копией Контент-планировщика
-- (см. /api/content/posts/...). Поля симметричны content_posts.
--
-- Применено через Mgmt API 2026-06-04.

ALTER TABLE public.ad_variants
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text;

COMMENT ON COLUMN public.ad_variants.scheduled_at IS
  'Когда планируется публикация в канал (МСК-aware UI). NULL=без расписания.';
COMMENT ON COLUMN public.ad_variants.published_at IS
  'Когда демон опубликовал в канал. NULL=ещё не публиковали.';
COMMENT ON COLUMN public.ad_variants.channel IS
  'Куда публиковать: telegram, vk. NULL=ещё не задан.';

-- Узкий индекс для publish-due — только записи которые ждут публикации.
CREATE INDEX IF NOT EXISTS ad_variants_due_idx
  ON public.ad_variants (tenant_id, status, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND published_at IS NULL;

-- Зеркалирование «feature-колонок» content_posts чтобы PostEditor работал
-- 1-в-1 без изменений (task 050: «копия системы Контента, ВСЁ как в оригинале»).
-- Все nullable, обратная совместимость не ломается.
ALTER TABLE public.ad_variants
  ADD COLUMN IF NOT EXISTS n integer,
  ADD COLUMN IF NOT EXISTS photo_tz text,
  ADD COLUMN IF NOT EXISTS approved_text boolean,
  ADD COLUMN IF NOT EXISTS approved_final boolean,
  ADD COLUMN IF NOT EXISTS comment_text text,
  ADD COLUMN IF NOT EXISTS comment_photo text,
  ADD COLUMN IF NOT EXISTS redo jsonb,
  ADD COLUMN IF NOT EXISTS feedback jsonb,
  ADD COLUMN IF NOT EXISTS photo_options jsonb,
  ADD COLUMN IF NOT EXISTS photos jsonb,
  ADD COLUMN IF NOT EXISTS channels_sel jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.ad_variants.n IS 'Порядковый номер варианта (как content_posts.n).';

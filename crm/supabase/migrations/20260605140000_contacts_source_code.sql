-- Task 052 (taksopark-machine, sergey-coder): атрибуция источников бота.
--
-- Бот @stolica_dostavka_zbium_bot вытаскивает `?start=<code>` из ссылки
-- и пишет код в contacts.source_code (один раз — на первом /start).
-- entry_segment — какое из 4 приветствий ушло кандидату (priezzhiy,
-- mestnyy, novichok, referral, generic).
--
-- Применено через Mgmt API 2026-06-05.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source_code text,
  ADD COLUMN IF NOT EXISTS entry_segment text;

COMMENT ON COLUMN public.contacts.source_code IS
  'Код источника из start-payload бота (напр. s_g42, ld_seg1, ref_id123). Справочник кодов в channels (kind=source_codes).';
COMMENT ON COLUMN public.contacts.entry_segment IS
  'Сегмент приветствия (priezzhiy/mestnyy/novichok/referral/generic), определённый по префиксу source_code.';

-- Узкий индекс для еженедельного разбора «диалоги по источникам».
CREATE INDEX IF NOT EXISTS contacts_source_code_idx
  ON public.contacts (tenant_id, source_code)
  WHERE source_code IS NOT NULL;

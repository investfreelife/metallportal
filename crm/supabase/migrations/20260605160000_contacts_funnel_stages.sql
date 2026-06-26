-- Task 056 (taksopark-machine, sergey-coder): расширение contacts под
-- «систему дожима» (knowledge-base/14_dozhim_and_crm_stages.md).
--
-- Стадии: new → contact → qualified → engaged → agreed → docs → scheduled →
--          online → retained; вне линии — sleeping/lost/spam.
-- next_touch_at — будильник касания (демон-мозг ставит «спросит через N часов»).
-- objections/promises jsonb — память воронки (что возражал, что обещал).
-- human_locked — флаг «руками довели/правили», агенты НЕ редактируют (см. ТЗ-058).
--
-- Применено через Mgmt API 2026-06-05.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS next_touch_at timestamptz,
  ADD COLUMN IF NOT EXISTS touch_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_direction text,
  ADD COLUMN IF NOT EXISTS objections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promises jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ready_date date,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS do_not_contact bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactivate_at timestamptz,
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS has_car bool,
  ADD COLUMN IF NOT EXISTS experience text,
  ADD COLUMN IF NOT EXISTS human_locked bool DEFAULT false;

CREATE INDEX IF NOT EXISTS contacts_stage_idx
  ON public.contacts (tenant_id, stage);
CREATE INDEX IF NOT EXISTS contacts_next_touch_idx
  ON public.contacts (tenant_id, next_touch_at)
  WHERE next_touch_at IS NOT NULL;

-- Бэкфил контактов из dialog_messages (Столица). Маппинг старых стадий:
--   wants→agreed, engaged→engaged, docs→docs, spam→spam, иначе new.
-- type='driver_candidate' (единственное допустимое contacts_type_check
-- для таксопарка — бот раньше использовал 'person', которое отвергалось).
INSERT INTO public.contacts (tenant_id, full_name, type, source, telegram_chat_id, stage)
SELECT DISTINCT ON (dm.chat_id)
  '66fe829e-22e8-4eda-8f9c-e8a131117a65'::uuid,
  COALESCE(dm.who, dm.username, 'TG ' || dm.chat_id),
  'driver_candidate',
  'telegram:legacy',
  dm.chat_id,
  CASE
    WHEN dm.stage='wants' THEN 'agreed'
    WHEN dm.stage='engaged' THEN 'engaged'
    WHEN dm.stage='docs' THEN 'docs'
    WHEN dm.stage='spam' THEN 'spam'
    ELSE 'new'
  END
FROM public.dialog_messages dm
WHERE dm.tenant_id='66fe829e-22e8-4eda-8f9c-e8a131117a65'
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.tenant_id='66fe829e-22e8-4eda-8f9c-e8a131117a65'
      AND c.telegram_chat_id = dm.chat_id
  )
ORDER BY dm.chat_id, dm.created_at DESC
ON CONFLICT DO NOTHING;

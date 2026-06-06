-- Tasks 065-067 (taksopark-machine, sergey-coder):
-- 1) contacts.labels jsonb — пользовательские метки на лиде/контакте
--    (для вкладки «💬 Общение», 066).
-- 2) Сид referral_program defaults в channels (kind=referral_program)
--    — для вкладки «🎁 Рефералка» (067). Параметры из knowledge-base/17.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS labels jsonb DEFAULT '[]'::jsonb;

-- GIN для быстрого фильтра «контакты с меткой X».
CREATE INDEX IF NOT EXISTS contacts_labels_gin
  ON public.contacts USING gin (labels)
  WHERE labels <> '[]'::jsonb;

-- Сид структуры рефералки (idempotent — INSERT … WHERE NOT EXISTS).
INSERT INTO public.channels (tenant_id, type, name, config)
SELECT
  '66fe829e-22e8-4eda-8f9c-e8a131117a65'::uuid,
  'tracking',
  'referral_program',
  jsonb_build_object(
    'kind', 'referral_program',
    'enabled', true,
    'inviter_reward', 3000,
    'inviter_threshold_shifts', 10,
    'newbie_reward', 2000,
    'statuses', jsonb_build_array(
      jsonb_build_object('name', '🥉', 'active_needed', 1),
      jsonb_build_object('name', '🥈', 'active_needed', 3),
      jsonb_build_object('name', '🥇', 'active_needed', 5),
      jsonb_build_object('name', '💎', 'active_needed', 10)
    ),
    'leaderboard', true,
    'note', 'Сидинг по дизайну knowledge-base/17_referral_program.md'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.channels
  WHERE tenant_id = '66fe829e-22e8-4eda-8f9c-e8a131117a65'
    AND type = 'tracking'
    AND config->>'kind' = 'referral_program'
);

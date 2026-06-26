-- TASK_013 ШАГ 1: добавить контактные поля для досье клиента.
-- Источник: app/queue/INBOX/TASK_013_history_calls_board_chat_tracker.md

ALTER TABLE dream_leads
  ADD COLUMN IF NOT EXISTS contact_name     TEXT,   -- имя контактного лица (может ≠ ЛПР)
  ADD COLUMN IF NOT EXISTS contact_position TEXT,   -- должность контакта (директор / админ / маркетолог)
  ADD COLUMN IF NOT EXISTS contact_email    TEXT,   -- email контакта (для коммерческого предложения)
  ADD COLUMN IF NOT EXISTS interest         TEXT;   -- интерес/тема разговора в свободной форме

COMMENT ON COLUMN dream_leads.contact_name     IS 'Имя контактного лица (может отличаться от ЛПР decision_maker_name)';
COMMENT ON COLUMN dream_leads.contact_position IS 'Должность контакта: директор / админ / маркетолог / др.';
COMMENT ON COLUMN dream_leads.contact_email    IS 'Email контакта для отправки коммерческого предложения';
COMMENT ON COLUMN dream_leads.interest         IS 'Интерес/тема разговора (свободный текст от звонилки)';

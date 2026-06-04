-- Sergey directive 2026-06-04 (Столица): «перевести из воронки в водители».
-- Расширяем contacts.type ENUM-как-check, чтобы поддержать:
--   • 'driver_candidate' — кандидат на водителя (попал в воронку)
--   • 'driver'           — действующий водитель (после promote)
--
-- Старые значения (lead/client/partner/supplier) сохраняются — это
-- метал-CRM use-case, не трогаем.

alter table public.contacts
  drop constraint if exists contacts_type_check;

alter table public.contacts
  add constraint contacts_type_check
  check (
    type is null
    or type = any (array[
      'lead'::text,
      'client'::text,
      'partner'::text,
      'supplier'::text,
      'driver_candidate'::text,
      'driver'::text
    ])
  );

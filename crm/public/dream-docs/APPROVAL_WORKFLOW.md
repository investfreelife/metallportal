# APPROVAL-FIRST WORKFLOW — Мечта

**Версия:** 1.0 (2026-06-18)
**Связан с:** TASK_CRM_approval_section.md (ТЗ кодеру на UI), CRM_DATA_CONTRACT.md, LANDING_FACTORY_AGENT_GUIDE.md

## Правило

> **Агент-кодер НЕ ВПРАВЕ собирать лендинг**, пока:
> - Sergey не утвердил build_plan (`build_status='approved'`)
> - И на лиде нет активных блокеров (`dream_lead_blockers` пусто)

Поток состояний `dream_leads.build_status`:

```
parsed                    ← парсер положил данные
   ↓
plan_proposed             ← агент-предлагатель плана сгенерил build_plan_json
   ↓
approved                  ← Sergey клик «Утвердить → в производство»
   ↓                        (или PATCH /api/dream/leads/<slug>/build-plan {build_status:'approved'})
built                     ← агент-кодер собрал лендинг, есть запись в dream_landings
   ↓
chosen                    ← Sergey выбрал активный вариант (is_chosen=true где-то)
```

Каждый переход требует:
- `parsed → plan_proposed` — агент (x-agent-token)
- `plan_proposed → approved` — **Sergey** (cookie-session, не агент!)
- `approved → built` — агент (x-agent-token)
- `built → chosen` — **Sergey**

## Структура build_plan_json

```json
{
  "design_ref": "modern" | "glossit-premium" | "hello-monday" | "huge" | "minimal",
  "sections": ["hero","services","gallery","reviews","about","contacts"],
  "photo_assignments": {
    "1": "hero",
    "3": "gallery",
    "5": "service:wash",
    "7": "about",
    "9": "NONE"
  },
  "video": {
    "enabled": true,
    "photo_idx": 1,
    "engine": "veo-3.1" | "seedance-2.0"
  },
  "seo": {
    "title": "...",
    "description": "...",
    "h1": "...",
    "section_texts": {
      "hero_lead": "...",
      "about_body": "..."
    }
  },
  "reviews_excluded": [3, 12, 27]
}
```

## Manual helper для Sergey (до внедрения UI)

Пока UI вкладки нет — Sergey может одобрять через прямой PATCH.
Скрипт `app/queue/scripts/approve_lead.py` (положу при необходимости) шлёт:

```bash
curl -X PATCH https://metallportal-crm2.vercel.app/api/dream/leads/avtoclean/build-plan \
  -H "Content-Type: application/json" \
  --cookie "crm_session=$(cat /tmp/sergey_session)" \
  -d '{"build_status":"approved"}'
```

ИЛИ через Management API SQL:
```sql
UPDATE dream_leads SET
  build_status='approved',
  build_approved_at=NOW(),
  build_approved_by='stolica'
WHERE slug='avtoclean';
```

## Что должен агент-кодер ПОСЛЕ внедрения UI

Перед запуском генерации:
```sql
SELECT build_status, build_plan_json FROM dream_leads WHERE slug=:slug;
```
Если `build_status != 'approved'` — **отказ**, лог `dream_landing_generations.status='blocked_not_approved'`.

Все решения берёт из `build_plan_json`:
- Дизайн = `design_ref`
- Какие фото и в какие секции = `photo_assignments`
- Видео = `video`
- Тексты = `seo.*`
- Отзывы = все ИСКЛЮЧАЯ `reviews_excluded`

После успешной сборки:
```sql
UPDATE dream_leads SET build_status='built' WHERE slug=:slug;
INSERT INTO dream_landings (...) VALUES (...);
```

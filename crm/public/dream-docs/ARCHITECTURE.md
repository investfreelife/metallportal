# 📐 Архитектура проекта «Мечта»

**Версия:** 2.0 (2026-06-18)
**Для кого:** оператор (Sergey), все агенты (парсер, кодер, продавец), любая будущая сессия Cowork.
**Источник правды:** этот файл. При расхождении с реальностью — обновляем файл, не код.

---

## 🎯 Бизнес-цель

Парсим бизнесы Москвы из Яндекс.Карт → отбираем без сайтов → делаем готовые лендинги на бесплатных хостингах → продаём за **25 000 ₽ единоразово**. Цель — 100 000 ₽/неделю при 4-5 продажах в неделю.

---

## 🏗 3 СЛОЯ архитектуры

```
┌──────────────────────────────────────────────────────────────┐
│  СЛОЙ 1 — PARSER STORAGE                                       │
│  github.com/investfreelife/dream-landings (приватный repo)    │
│                                                                │
│  Что хранит: тяжёлое сырьё парсера                            │
│   - <slug>/photos/NN.webp    (24-50 фото на лида ≤200KB)       │
│   - <slug>/data.json         (основные поля лида)              │
│   - <slug>/reviews.json      (50 отзывов sample)               │
│   - <slug>/services.json     (10-20 услуг с ценами)            │
│   - <slug>/photos.json       (список фото с idx/priority)      │
│                                                                │
│  Доступ агентам: raw.githubusercontent.com/.../<slug>/...     │
│  Зачем: чтобы НЕ нагружать Supabase 1GB Free квоту            │
└──────────────────┬───────────────────────────────────────────┘
                   │ Агент-парсер пишет, агент-кодер читает
                   ↓
┌──────────────────────────────────────────────────────────────┐
│  СЛОЙ 2 — CRM (Supabase Postgres)                            │
│  metallportal-crm2.vercel.app/dream                          │
│  project: tmzqirzyvmnkzfmotlcj                               │
│  tenant_id: 11111111-2222-3333-4444-555555555555             │
│                                                                │
│  Что хранит: МЕТАДАННЫЕ (только URL и записи, не файлы)       │
│   - dream_businesses         (Discovery — OSM сырьё)           │
│   - dream_leads              (enriched лиды, статус воронки)   │
│   - dream_lead_photos        (idx + URL + priority/deleted)    │
│   - dream_lead_reviews       (sample 50 отзывов)               │
│   - dream_lead_services      (10 услуг с ценами)               │
│   - dream_lead_comments      (заметки оператора с фото)        │
│   - dream_lead_transitions   (журнал переходов воронки)        │
│   - dream_landings           (несколько вариантов сайта/лид)   │
│   - dream_landing_generations (логи запусков агента-кодера)    │
│   - dream_agency_sites       (наши студийные витрины)          │
│   - dream_discovery_runs     (запуски парсера)                 │
│   - dream_activities         (журнал активностей outreach)     │
│                                                                │
│   - contacts/deals (синк-триггер dream_lead_sync_contact)      │
└──────────────────┬───────────────────────────────────────────┘
                   │ Sergey через UI → утверждает план → кодер собирает
                   ↓
┌──────────────────────────────────────────────────────────────┐
│  СЛОЙ 3 — PRODUCTION SITES                                    │
│  github.com/investfreelife/investfreelife.github.io           │
│  (GitHub Pages — отдельный репо, ТОЛЬКО готовые сайты)         │
│                                                                │
│  Что лежит: готовые HTML лендинги                              │
│   - investfreelife.github.io/             (главная Nimbo)      │
│   - investfreelife.github.io/studio/      (флагман витрины)    │
│   - investfreelife.github.io/monday/      (стиль monday)       │
│   - investfreelife.github.io/<slug>/      (клиентский лендинг) │
│   - investfreelife.github.io/<slug>/pro/  (PRO вариант)        │
│                                                                │
│  Доступ клиентам: публичная ссылка из outreach                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 ВОРОНКА — 12 состояний build_status

```
parsed → enriching → plan_proposed → APPROVED → building → built → review_built → for_sale → selling → sold
                                       (Sergey)                                      (Sergey)
                                                                                                          \
                                                                                                            → lost
                                       ↓ override
                                     trash (с возможностью вернуть «всё равно делать»)
```

| Status | Кто переводит | Действие |
|---|---|---|
| `parsed` | парсер | положил исходник |
| `enriching` | агент-проверщик | Bright Data + фото + услуги + отзывы |
| `plan_proposed` | агент-проверщик | положил `build_plan_json` |
| `approved` | **Sergey** | утвердил план |
| `building` | агент-кодер | взял в работу |
| `built` | агент-кодер | сайт собран, ряд в `dream_landings` |
| `review_built` | автомат | автоматом после `built` |
| `for_sale` | **Sergey** | посмотрел сайт, одобрил для продажи |
| `selling` | агент-продавец | outreach начался |
| `sold` | агент-продавец | купили |
| `lost` | агент-продавец | отказались |
| `trash` | **Sergey** или агент | мусор (есть свой сайт, закрыты) |

**Override блокера:** если на лиде `dream_lead_blockers` пуст НЕ ИЛИ есть, но Sergey решил переопределить — в API `/transition` передаёт `reason` со словом «override» или «всё равно». Журналируется в `dream_lead_transitions`.

---

## 🚦 PRE-FLIGHT CHECK (обязательно для агентов)

Перед ЛЮБОЙ работой по лиду агент **обязан** проверить:

```sql
-- 1. Активные блокеры?
SELECT * FROM dream_lead_blockers WHERE lead_id = :lead_id;
-- если ЕСТЬ строки → STOP, лог dream_landing_generations.status='blocked_by_comment'

-- 2. Approval пройден? (только для агента-кодера)
SELECT build_status FROM dream_leads WHERE id = :lead_id;
-- если != 'approved' → STOP, лог status='blocked_not_approved'

-- 3. build_plan существует? (только для агента-кодера)
SELECT build_plan_json FROM dream_leads WHERE id = :lead_id;
-- если NULL → STOP, нет указаний что собирать
```

Все три зелёные → можно работать. Иначе **stop + лог + Sergey получит уведомление** (через `dream_activities`).

---

## 🗂 Схема БД (детально)

### dream_leads (центр всего)

```sql
id              bigint PK
slug            text UNIQUE   -- 'avtoclean'
tenant_id       uuid          -- всегда 11111111-2222-3333-4444-555555555555
name, niche, city, address
phone, phone_display, email
metro_nearest
rating, reviews_count, ratings_count
services_count, photos_count
hours_json, features_json
geo_lat, geo_lon
description_short, description_long
completeness_score                       -- 0.00-1.00
build_status                             -- ВОРОНКА (12 значений выше)
build_plan_json                          -- утверждённый план сборки
build_approved_at, build_approved_by
landing_storage_path                     -- legacy, не используем
landing_public_url                       -- chosen URL (триггер dream_landing_chosen_sync)
landing_deployed_url
status                                   -- legacy sales status
contact_id, deal_id                      -- FK на общие contacts/deals (триггер)
```

### dream_lead_photos

```sql
id          bigserial PK
lead_id     → dream_leads
idx         int                          -- порядок (1..N)
url         text                         -- raw.githubusercontent.com/.../NN.webp
source_url  text                         -- оригинал Yandex CDN
storage_path text                        -- legacy NULL
width, height, bytes
priority    bool                         -- ⭐ агент-кодер использует ТОЛЬКО priority=true
deleted     bool                         -- 🗑 не используется (мусор, куртки)
note        text
UNIQUE(lead_id, idx)
```

### dream_lead_comments + view dream_lead_blockers

```sql
dream_lead_comments:
  id, lead_id, tenant_id
  author       -- 'stolica' / 'agent:parser' / 'agent:coder'
  kind         -- 'note' | 'fact' | 'issue' | 'blocker'
  text
  attachment_url, attachment_path, attachment_bytes
  is_resolved, resolved_at, resolved_by
  created_at

VIEW dream_lead_blockers:
  SELECT lead_id, blockers[], blocker_ids[]
  FROM dream_lead_comments
  WHERE kind='blocker' AND is_resolved=FALSE
  GROUP BY lead_id
```

### dream_landings (несколько вариантов на лид)

```sql
id            bigserial PK
lead_id       → dream_leads
tenant_id     uuid
variant       text                       -- 'modern', 'pro', 'minimal', ...
version       text                       -- 'v1', 'v2', ...
template_id   text
storage_prefix text                      -- investfreelife.github.io/<slug>/
entry_url     text                       -- главная страница (URL)
pages         jsonb                      -- [{slug,title,url,bytes},...]
meta          jsonb                      -- {host,repo,reference,features[],photos}
status        text                       -- draft/published/archived/failed
is_chosen     bool                       -- ⭐ активный (триггер dream_landing_chosen_sync синкает в dream_leads.landing_public_url)
deployed_url, deploy_target, deployed_at
generated_at, updated_at
UNIQUE(lead_id, variant, version)
```

### dream_agency_sites (наши студийные витрины)

```sql
id, tenant_id
slug UNIQUE        -- 'main','studio','monday','huge','leads'
title, kind        -- 'studio'/'demo'/'experiment'/'landing-template'
url                -- investfreelife.github.io/...
description, reference, features[]
is_featured        -- показывать на главной /dream
status             -- live/draft/archived
```

### Связи (FK)

```
dream_businesses → dream_leads (через dream_businesses.dream_lead_id)
dream_leads → dream_lead_photos / reviews / services / comments / transitions / landings (CASCADE)
dream_leads → contacts / deals (через триггер dream_lead_sync_contact)
dream_landings → dream_leads (CASCADE)
dream_lead_blockers — VIEW на dream_lead_comments
```

---

## 🔌 API endpoints

| Endpoint | Метод | Auth | Назначение |
|---|---|---|---|
| `/api/auth/login` | POST | — | Логин (scrypt + rate-limit 30/15min) |
| `/api/auth/logout` | POST | cookie | |
| `/api/auth/switch-tenant` | POST | cookie + superadmin | Переключить tenant в Sidebar |
| `/api/tenants/list` | GET | cookie | Список тенантов (для superadmin dropdown) |
| `/api/dream/businesses` | GET | cookie | Список с map_url для канбана-парсера |
| `/api/dream/leads/import` | POST | x-agent-token | Bulk upsert лидов от парсера |
| `/api/dream/leads/[slug]` | GET/PATCH | cookie | Карточка лида |
| `/api/dream/leads/[slug]/activity` | POST | x-agent-token | Запись активности (outreach лог) |
| `/api/dream/leads/[slug]/status` | PATCH | cookie | Legacy sales status |
| `/api/dream/leads/[slug]/photos/[idx]` | PATCH | cookie | ⭐ priority / 🗑 deleted |
| `/api/dream/leads/[slug]/comments` | GET/POST | both | Комментарии + загрузка фото |
| `/api/dream/leads/[slug]/comments/[id]` | PATCH/DELETE | cookie | Закрыть/удалить коммент |
| `/api/dream/leads/[slug]/build-plan` | GET/PATCH | both | Чтение/запись build_plan + статус |
| `/api/dream/leads/[slug]/transition` | POST | both | Переход в воронке с валидацией |
| `/api/dream/landings/register` | POST | x-agent-token | Регистрация готового сайта |
| `/api/dream/landings/[id]/chosen` | POST | cookie | Сделать вариант активным |

### Auth-токены

- **x-agent-token**: `AGENT_WEBHOOK_TOKEN` из `.env.local` → используется агентами (парсер, кодер, продавец)
- **x-agent-name**: header идентифицирует кто из агентов пишет (`agent:parser`, `agent:coder`)
- **crm_session cookie**: подписанный JWT, выдаётся /api/auth/login (HMAC-SHA256 + SESSION_SECRET)
- **is_superadmin**: флаг в admin_users — даёт TenantSwitcher и право апрувить

---

## 📍 UI карты `/dream/*`

```
/dream                  Дашборд (KPI воронки)
/dream/kanban           📊 Канбан-воронка (7 колонок)
/dream/leads            📋 Таблица всех лидов
/dream/leads/<slug>     Карточка лида (7 вкладок ниже)
/dream/parser           🛰 Парсер (3 вкладки: все/без сайта/полный парсинг)
/dream/landings         🎨 Лендинги клиентов
/dream/agency-sites     ✨ Сайты студии Nimbo
/dream/outreach         📨 Outreach
/dream/agent-rules      📖 Правила агентам (этот документ кратко)
/dream/analytics        Аналитика
/dream/finance          💰 Финансы
```

### Карточка лида `/dream/leads/<slug>` — 7 вкладок

| Вкладка | Что внутри |
|---|---|
| **📋 Обзор** | name/phone/address/metro/rating + контакты |
| **📷 Фото (N/M)** | сетка фото с ⭐/🗑 кнопками на каждом, фильтр «показать удалённые» |
| **🛠 Услуги (N)** | список с ценами, отсортированы по цене |
| **💬 Отзывы (N)** | sample 50, фильтр по rating |
| **🌐 Лендинг (N)** | ВСЕ варианты dream_landings с кнопкой «Сделать активным» |
| **💬 Комментарии (N) 🛑M** | composer (текст+тип+фото) + список, активные блокеры красным сверху |
| **📝 Журнал (N)** | dream_activities (outreach лог) |

---

## ⚖️ Жёсткие правила

1. **PRE-FLIGHT CHECK обязателен.** Без него агент = бан.
2. **Никаких файлов >200 KB в Supabase Storage.** Исключение — `dream-comments` (300 KB на attachment оператора).
3. **Yandex CDN URL — для оригиналов фото лидов**, никогда не качать в Supabase.
4. **WebP** для фото в `dream-landings` (parser storage), JPG/PNG → fail на CI.
5. **Относительные ссылки** в HTML лендингов (чтобы переехать с github.io на свой домен).
6. **Без выдумок** (годы работы, акции, награды). Только из CRM или пусто.
7. **set_chosen / approved / is_resolved (на блокерах)** = только Sergey, не агент.
8. **Секреты только в `/Users/Shared/металл/_SECRETS/`**, никогда в чате/логах/git.
9. **build_status='approved' обязателен** для агента-кодера. Иначе STOP.
10. **Override блокера** — только через `reason` с явным словом «override».

---

## 🗝 Tenant IDs

| Tenant | UUID | Industry |
|---|---|---|
| Металлпортал | `a1000000-0000-0000-0000-000000000001` | `metal` |
| Таксопарк Столица | `66fe829e-22e8-4eda-8f9c-e8a131117a65` | `taxi` |
| **Мечта** | `11111111-2222-3333-4444-555555555555` | `landing_factory` |

Sergey (login `stolica` или `admin`) — `is_superadmin=true`, переключает тенанты через ⇅ в Sidebar.

---

## 🚀 Workflow «от лида до продажи» — пошагово

```
1. ПАРСИНГ (агент-парсер)
   - OSM Overpass → 713 бизнесов Москвы (Discovery)
   - dream_businesses INSERT с canon_key=sha1(name+address+phone) UNIQUE
   - Фильтр has_website=0 → 277 кандидатов на enrichment

2. ENRICHMENT (агент-проверщик)
   - Bright Data fetch yandex_url → parse → data.json/reviews.json/services.json
   - photo URLs из gallery (НЕ из reviews — там куртки авторов!)
   - download → webp → push в dream-landings/<slug>/photos/
   - POST /api/dream/leads/import → dream_leads INSERT
   - INSERT dream_lead_photos (url=raw.github, source_url=yandex CDN)
   - INSERT dream_lead_reviews + services
   - PATCH build-plan → build_status='plan_proposed' + build_plan_json

3. УТВЕРЖДЕНИЕ (Sergey)
   - /dream/kanban → колонка «🧩 На утверждение»
   - Клик карточка → /dream/leads/<slug>
   - Вкладка Фото: ⭐ на лучших, 🗑 на мусоре
   - Вкладка Комментарии: убирает блокеры (если есть)
   - Кнопка «✅ Утвердить план» → build_status='approved'

4. ПРОИЗВОДСТВО (агент-кодер)
   - SELECT dream_lead_blockers + dream_leads.build_status (pre-flight)
   - Если approved → build_status='building'
   - Читает priority фото, services, reviews, build_plan_json
   - Рендер HTML (template = build_plan_json.design_ref)
   - Push в investfreelife.github.io/<slug>/<variant>-<version>/
   - POST /api/dream/landings/register → dream_landings INSERT
   - PATCH /transition → build_status='built'

5. ПРОВЕРКА САЙТА (Sergey)
   - /dream/kanban → колонка «🔍 Проверка сайта»
   - Открывает сайт по entry_url
   - Если ОК → клик «✅ В продажу» → build_status='for_sale'
   - Если не ОК → пишет коммент → агент пересобирает

6. ПРОДАЖА (агент-продавец)
   - WhatsApp/Telegram/звонок по phone из dream_leads
   - Шлёт ссылку landing_public_url
   - PATCH /transition → build_status='selling'
   - При продаже → 'sold' / при отказе → 'lost'

7. АТРИБУЦИЯ
   - UTM в кнопках лендинга (utm_source=dream-landing&utm_campaign=<slug>)
   - dream_activities (outreach лог)
   - Триггер contacts/deals синкает лида в общую CRM
```

---

## 🗄 Где что лежит — карта файлов

| Где | Что |
|---|---|
| `~/Documents/Claude/Projects/Мечта/` | Локальный проект Sergey'я (парсер, CLAUDE.md, HANDS_AGENT_PROTOCOL.md) |
| `~/Documents/Claude/Projects/Мечта/app/queue/SPEC/*` | Спецификации (этот файл, CRM_DATA_CONTRACT.md, LANDING_FACTORY_AGENT_GUIDE.md, APPROVAL_WORKFLOW.md) |
| `~/Documents/Claude/Projects/Мечта/app/queue/INBOX/*` | ТЗ для агента-кодера CRM (TASK_*) |
| `~/Documents/Claude/Projects/Мечта/landings/<slug>/` | Локальные артефакты парсера (raw HTML, data.json) |
| `~/Documents/Claude/Projects/Мечта/site/<slug>/` | Локальные исходники готовых сайтов |
| `/Users/Shared/металл/metallportal/crm/` | Код CRM (Next.js) |
| `/Users/Shared/металл/_SECRETS/` | Защищённые env-файлы (chmod 600) |
| `github.com/investfreelife/metallportal` | Репо CRM (приватный) |
| `github.com/investfreelife/dream-landings` | Repo parser storage (приватный) |
| `github.com/investfreelife/investfreelife.github.io` | Repo готовых сайтов (публичный, для Pages) |

---

## 🧠 Memory ссылки (для будущих сессий)

- `dream_crm_data_contract_and_integration.md` — общая интеграция в CRM
- `dream_approval_first_workflow.md` — approval gate
- `dream_comments_and_blockers.md` — комментарии + блокеры
- `law_heavy_files_free_storage_crm_metadata_only.md` — глобальный ЗАКОН про storage
- `metallportal_supabase_billing_quota_critical.md` — урок про Free quota lockup

---

_Документ стабилен. Любые изменения через PR + бамп версии._

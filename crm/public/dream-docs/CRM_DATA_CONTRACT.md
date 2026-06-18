# CRM DATA CONTRACT — куда парсер пишет данные

**Версия:** 2.0 (2026-06-18)
**Статус:** обязательная для всех парсинг-задач (TASK_008+, BD pipeline, OSM Discovery)
**Источник правды:** этот файл. Если в коде расхождение — менять код, не контракт.

---

## 🛑 PRE-FLIGHT CHECK для парсера и кодера (обязательно)

ПЕРЕД любой работой по лиду агент ОБЯЗАН:

1. **Прочитать блокеры:**
   ```sql
   SELECT * FROM dream_lead_blockers WHERE lead_id = :lead_id;
   ```
   Если хоть один — STOP. Текст блокера = причина (пример: «у компании уже есть сайт example.ru», «закрыты с мая 2025»).

2. **Прочитать комментарии** (опц., но рекомендуется):
   ```sql
   SELECT kind, text FROM dream_lead_comments WHERE lead_id = :lead_id AND is_resolved = FALSE;
   ```
   - `note` — учти в работе
   - `fact` — реальные данные (телефон, цены могут отличаться от спарсенных)
   - `issue` — проблема для агента (битое фото, кривой текст)

3. **Apruvаl-первый workflow** — `build_status='approved'` обязателен для кодера (для парсера — нет).

См. подробно: `APPROVAL_WORKFLOW.md` + страница `/dream/agent-rules` в CRM.

---

## ⚖️ ЗАКОН 0 — Heavy/Temp файлы НЕ в Supabase. CRM хранит МЕТАДАННЫЕ.

Установлен 2026-06-18 после блокировки **всех** tenants по Supabase Free quota.

**ТЫ НЕ ДОЛЖЕН** заливать в Supabase Storage:
- Фотографии оригинального разрешения
- Видео
- Raw HTML спарсенных страниц
- Любые файлы > 200 KB которые можно вернуть из источника

**ТЫ ХРАНИШЬ В CRM (Supabase) ТОЛЬКО:**
- URL оригинала (Yandex CDN, 2GIS CDN и т.д.) — `text`
- Путь до permanent artifact (если уже сгенерён лендинг — URL на Pages)
- Метаданные: размер, MIME-type, источник, дата, статус
- Связи: lead_id, agent_id, run_id

**Жизненный цикл фото лида:**
```
Yandex CDN URL ─────→  dream_lead_photos.url (только текст в БД)
                       ↑
агент-кодер лендинга качает на ВРЕМЯ ↓
                       ↓
                       /tmp/lead_<slug>/photos/01.jpg  ← rм после генерации
                       ↓
   готовый лендинг → пушится на GitHub Pages (с встроенными optimised .webp)
                       ↓
   /tmp удаляется ───→ нигде не висит
```

**Где permanent артефакты:**
- HTML-лендинги, готовые → **GitHub Pages** репо `dream-landings` (бесплатно, навсегда)
- Тяжёлый медиа > 5 MB на лендинг → **Cloudflare R2** ($0.015/GB, 0₽ egress)
- Временный буфер агентов → **Oracle ARM Free** (24 GB, бесплатно)
- Спарсенные оригиналы → **только URL источника**, не качаем

См. полный закон: `~/.claude/projects/-Users-sergey/memory/law_heavy_files_free_storage_crm_metadata_only.md`

---

## 1. Архитектура — кто куда пишет

```
┌─────────────────────────────────────┐
│  Локальный SQLite (мак Sergey)      │   ← TODO: deprecate
│  ~/Мечта/app/data/bd_pipeline.db   │
└─────────────────────────────────────┘
              │
              │ (одноразовый bulk-sync, потом убрать)
              ▼
┌─────────────────────────────────────────────────────┐
│  Supabase Production                                 │
│  project: tmzqirzyvmnkzfmotlcj                       │
│  url: https://tmzqirzyvmnkzfmotlcj.supabase.co       │
│                                                       │
│  PostgreSQL (Database) ──→ для metadata             │
│  Storage (S3-compatible) ──→ для фото/HTML лендинга │
└─────────────────────────────────────────────────────┘
              ▲
              │ writes via REST/SQL/Storage
              │
┌─────────────────────────────────────┐
│  Агент-парсер (ТЫ)                   │
│  POST к нашим endpoints              │
│  или INSERT через Supabase API       │
└─────────────────────────────────────┘
              │
              │ (отображается в UI)
              ▼
┌─────────────────────────────────────────────────────┐
│  CRM https://metallportal-crm2.vercel.app/dream/*   │
│  - /dream — дашборд                                 │
│  - /dream/parser — 3 вкладки (всё / без сайта / enr)│
│  - /dream/leads — таблица                            │
│  - /dream/leads/<slug> — карточка                   │
└─────────────────────────────────────────────────────┘
```

**TENANT_ID для Мечты:** `11111111-2222-3333-4444-555555555555`. Это **всегда**
в каждой строке. Не путать с tenant'ами Металлпортала / Таксопарка.

---

## 2. Авторизация

### Webhook token (для записи)

Все POST-запросы шлёшь с заголовком:
```
x-agent-token: agt_pSq3q-sxavoEolWOFrrRmoXpgvBCAVXiVt-_AtzWISE
```

Лежит в:
- macOS Sergey: `/Users/Shared/металл/metallportal/.env.local` (переменная `AGENT_WEBHOOK_TOKEN`)
- Vercel: уже настроено в env проекта `metallportal-crm2`

Если получаешь HTTP 401 — токен не передан или некорректен.
Если 403 — токен правильный, но Vercel WAF блочит (нужен retry через секунду).

### Supabase Service Role Key (для прямого INSERT)

Альтернативный путь — писать напрямую в Postgres минуя CRM endpoints.
Live ключ в `_SECRETS` (на маке Sergey) и `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=<длинный JWT, начинается с eyJ...>
SUPABASE_URL=https://tmzqirzyvmnkzfmotlcj.supabase.co
```

**Никогда не светить в чат / git / логи.** Только в защищённых env.

---

## 3. Таблицы — что куда писать

### 3.1 `dream_discovery_runs` — каждый запуск парсера

Регистрируй **до** старта работы и обновляй **после** завершения.

| Колонка | Тип | Когда писать |
|---|---|---|
| `tenant_id` | uuid | всегда `11111111-2222-3333-4444-555555555555` |
| `source` | text | `osm_overpass` / `bd_discover` / `yandex_business` |
| `mode` | text | `pilot` (1 ниша×1 город) / `bulk` (массовый) / `niche_expand` |
| `niche` | text | название ниши (`Автосервисы`, `Парикмахерские`, …) |
| `city` | text | `Москва` (пока единственный город) |
| `query` | text | сам Overpass-query или BD-prompt — для debug |
| `found` | int | сколько строк нашли (до дедупа) |
| `imported` | int | сколько реально INSERT/UPDATE сделали |
| `skipped` | int | дубли по canon_key |
| `status` | text | `running` → `success` / `failed` |
| `cost_usd` | numeric | стоимость (для BD), 0 для OSM |
| `error_message` | text | если failed — что упало |
| `metadata` | jsonb | любой дамп (request_id, bbox, версия парсера) |
| `started_at` | timestamptz | NOW() в момент старта |
| `finished_at` | timestamptz | NOW() когда закончил |

**Пример INSERT:**
```sql
INSERT INTO dream_discovery_runs
  (tenant_id, source, mode, niche, city, query, found, imported, skipped, status,
   cost_usd, metadata, started_at, finished_at)
VALUES
  ('11111111-2222-3333-4444-555555555555', 'osm_overpass', 'bulk',
   'Стоматологии', 'Москва',
   '[out:json];area["name"="Москва"]->.a;(node["amenity"="dentist"](area.a););out tags center;',
   147, 142, 5, 'success', 0,
   '{"endpoint":"overpass-api.de","duration_sec":12}'::jsonb,
   NOW() - interval '12 seconds', NOW())
RETURNING id;
```

### 3.2 `dream_businesses` — ВСЁ что нашёл Discovery (ЭТАП 1)

**Самая большая таблица.** Сюда идёт сырьё OSM + BD Discover, до фильтра по has_website.

| Колонка | Обязательно | Что |
|---|---|---|
| `tenant_id` | ✅ | uuid Мечты |
| `canon_key` | ✅ | `sha1(name + address + phone)` — **дедуп**, UNIQUE |
| `name` | ✅ | название бизнеса |
| `category` | | OSM tag amenity/shop/office |
| `niche` | ✅ | человеческое название (`Автосервисы`) |
| `city` | ✅ | `Москва` |
| `address` | важно | для outreach обязательно |
| `lat` / `lon` | | для карты |
| `phone` | важно | для outreach обязательно |
| `email` | | редко в OSM |
| `yandex_url` | важно | для ЭТАПА 3 enrichment'a критично |
| `gis_url` | | если есть |
| `instagram` / `vk` / `telegram` / `whatsapp` | | из contact:* OSM-тегов |
| `has_website` | ✅ | 1 если есть website / website_url, иначе 0. **Главный фильтр ЭТАПА 2** |
| `website_url` | | если has_website=1 |
| `rating` / `review_count` / `opening_hours` | | если знаем из OSM/discovery |
| `raw_data` | | jsonb — сырой dump OSM tags / BD discover result |
| `discovered_at` | ✅ | NOW() — когда первый раз нашли |
| `last_seen_at` | ✅ | NOW() — обновляется на повторных run'ах |
| `enrichment_status` | | `pending` (по умолчанию) / `running` / `success` / `failed` / `skipped` |

**Idempotent INSERT:**
```sql
INSERT INTO dream_businesses (
  tenant_id, canon_key, name, niche, city, address, lat, lon,
  phone, yandex_url, has_website, raw_data,
  discovered_at, last_seen_at
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  encode(sha1(:name || coalesce(:address, '') || coalesce(:phone, ''))::bytea, 'hex'),
  :name, :niche, 'Москва', :address, :lat, :lon,
  :phone, :yandex_url, :has_website,
  :raw_jsonb,
  NOW(), NOW()
)
ON CONFLICT (canon_key) DO UPDATE SET
  last_seen_at = NOW(),
  has_website  = EXCLUDED.has_website,
  phone        = COALESCE(EXCLUDED.phone, dream_businesses.phone),
  yandex_url   = COALESCE(EXCLUDED.yandex_url, dream_businesses.yandex_url),
  raw_data     = EXCLUDED.raw_data;
```

После INSERT — обнови `dream_discovery_runs.imported += 1` для активного run.

### 3.3 `dream_leads` — ENRICHED PREMIUM лиды (ЭТАПЫ 3-5)

Когда прошёл Bright Data enrichment и `completeness_score ≥ 0.65`.

| Колонка | Тип | Что |
|---|---|---|
| `tenant_id` | uuid | ✅ |
| `slug` | text | UNIQUE, kebab-case (`avtoclean`, `barbershop-vernadskogo-12`) |
| `name`, `niche`, `city`, `address` | | как в businesses |
| `phone` / `phone_display` / `yandex_url` / `yandex_id` / `gis_url` | | контакты |
| `metro_nearest` | | из inline state Яндекса |
| `email`, `social_json` | | если нашли |
| `has_website` | int | дублирует businesses для скорости |
| `website_url` | text | |
| `rating` / `reviews_count` / `ratings_count` | | агрегаты |
| `services_count` / `photos_count` | int | для бейджа в UI |
| `features_json` | jsonb | массив строк особенностей |
| `hours_json` | jsonb | `{is_24_7, structured: {mon,...,sun}, current_status}` |
| `geo_lat` / `geo_lon` | | |
| `description_short` / `description_long` | | для лендинга и outreach |
| `completeness_score` | numeric | 0.00-1.00, см. SPEC ЭТАП 4 |
| `folder_path` | text | путь на маке (legacy, **не использовать на проде**) |
| `landing_html_path` | text | путь к index.html на маке |
| `landing_storage_path` | text | ключ в Storage bucket: `<slug>/index.html` |
| `landing_public_url` | text | публичная ссылка на Storage |
| `landing_deployed_url` | text | внешний URL когда задеплоим на GitHub Pages/Netlify |
| `status` | text | `enriched` → `generated` → `outreach` → `contacted` → `hot` → `proposal` → `won`/`lost` |
| `price` | int | 25000 (₽) по умолчанию |
| `notes` | text | свободный текст для оператора |
| `ai_summary` / `ai_pitch` | text | если генерили через LLM |
| `created_at` / `updated_at` | timestamptz | автоматом |

**Endpoint для записи enriched лида (рекомендованный путь):**

```
POST https://metallportal-crm2.vercel.app/api/dream/leads/import
Headers:
  Content-Type: application/json
  x-agent-token: agt_pSq3q-sxavoEolWOFrrRmoXpgvBCAVXiVt-_AtzWISE
Body:
{
  "run_id": 5,                    // id из dream_discovery_runs (опционально)
  "leads": [
    {
      "slug": "avtoclean",
      "name": "Avtoclean",
      "niche": "Автомойка / Автосервис",
      "city": "Москва",
      "address": "просп. Вернадского, 102А",
      "metro_nearest": "Тропарёво",
      "phone": "+79164665460",
      "phone_display": "+7 (916) 466-54-60",
      "yandex_url": "https://yandex.ru/maps/org/avtoclean/167023621570/",
      "yandex_id": "167023621570",
      "has_website": 0,
      "rating": 4.4,
      "reviews_count": 110,
      "ratings_count": 176,
      "services_count": 10,
      "photos_count": 33,
      "features_json": ["24 часа", "Wi-Fi", "Кафе"],
      "hours_json": {"is_24_7": true, "structured": {...}},
      "geo_lat": 55.6469, "geo_lon": 37.4752,
      "description_short": "Автомойка 24/7 у Тропарёво — 4.4★",
      "description_long": "Полное описание...",
      "completeness_score": 0.90
    }
  ]
}
```

Upsert по `slug`. Sales workflow поля (`status`, `notes`, `contacted_at`, `sold_at`, `price`) **сохраняются** при повторном run — не перезаписываются.

### 3.4 `dream_lead_photos` — фото enriched лида

**⛔ НЕ КАЧАТЬ в Supabase Storage** (см. ЗАКОН 0).

Фото живут на **Yandex CDN навсегда**. Мы храним только URL.

**Откуда брать URL'ы:**
- При парсинге Яндекс.Карт извлекать атрибуты `src` / `srcset` из `<img>` тегов на странице бизнеса (raw HTML).
- Регексп: `r'https://avatars\.mds\.yandex\.net/get-altay/[^?"\'\s]+'`
- Нормализуй размер на `orig`: `re.sub(r'/(S|M|L|L_height|S_height|M_height)$', '/orig', url)`

**INSERT в БД (один curl, без Storage upload):**
```sql
INSERT INTO dream_lead_photos (lead_id, idx, url, source_url, width, height, bytes)
VALUES
  (:lead_id, 1, 'https://avatars.mds.yandex.net/get-altay/...../orig',
                'https://avatars.mds.yandex.net/get-altay/...../orig',
   NULL, NULL, NULL)
ON CONFLICT (lead_id, idx) DO UPDATE SET url = EXCLUDED.url;
```

- `storage_path` теперь **всегда NULL** (legacy колонка, потом удалим).
- `url` = `source_url` = Yandex CDN URL. Один и тот же.
- `width`/`height`/`bytes` — опционально (если HEAD-ом проверял).

После UPDATE — `dream_leads.photos_count = COUNT(*)`.

**Что увидит CRM UI** — `<img src="{photo.url}" loading="lazy">` тащит напрямую с
Yandex CDN. Скорости одинаковые (Yandex CDN близок к РФ).

### 3.5 `dream_lead_reviews` — отзывы

Bulk INSERT всех отзывов из `reviews.json sample[]`:

```sql
INSERT INTO dream_lead_reviews (lead_id, idx, author, rating, review_date, text, source)
VALUES
  (:lead_id, 1, 'Полианна Волкова', NULL, '2024-09-24', 'Отличная мойка...', 'yandex_maps'),
  (:lead_id, 2, 'Муса Магомедов', NULL, '2025-05-28', 'Качественно...', 'yandex_maps')
ON CONFLICT (lead_id, idx) DO UPDATE SET text = EXCLUDED.text;
```

Если у Яндекса агрегат `rating` / `reviews_count` известен, но сами отзывы запросили только sample 50 — это нормально.
`reviews_count` в `dream_leads` показывает агрегат (110), а в `dream_lead_reviews` лежат конкретные 50 sample-отзывов с текстами.

### 3.6 `dream_lead_services` — услуги с прайсом

```sql
INSERT INTO dream_lead_services (lead_id, idx, name, price, unit, source, is_default)
VALUES
  (:lead_id, 1, 'Стандартная мойка', 600, 'руб', 'yandex_menu', false),
  (:lead_id, 2, 'Комплексная мойка', 1000, 'руб', 'yandex_menu', false),
  (:lead_id, 3, 'Керамика Ceramic PRO', 22000, 'руб', 'yandex_menu', false)
ON CONFLICT (lead_id, idx) DO UPDATE SET price = EXCLUDED.price;
```

Если Яндекс-меню пустое — заполнить из `app/data/default_prices/<niche>.json` и поставить `is_default = true`.

### 3.7 Готовый HTML лендинга — НЕ в Supabase

**Лендинги живут на GitHub Pages** (бесплатно, навсегда, версионируется).

См. подробный гайд: `LANDING_FACTORY_AGENT_GUIDE.md` раздел «Куда деплоить».

В БД пишешь **только URL** финального лендинга:
```sql
UPDATE dream_leads SET
  landing_deployed_url = 'https://investfreelife.github.io/dream-landings/avtoclean/modern-v1/',
  status = 'generated'
WHERE slug = 'avtoclean';
```

И в таблице `dream_landings` (множественные варианты на лид) — `entry_url`
ведёт на GitHub Pages (или Cloudflare Pages если перешли).

**Сырые HTML парсера (`yandex_main.html` и т.д.) НЕ хранятся в Supabase.**
Это технические файлы агента-парсера. Жизненный цикл:
- Скачал → `/tmp/parser_<run_id>/raw/yandex_main.html`
- Распарсил → данные в БД
- Удалил `/tmp/parser_<run_id>/`

Если нужно архивировать (для отладки) — Oracle ARM `/var/www/parser-archive/<run_id>.tar.gz`.

---

## 4. Workflow для одного лида end-to-end

```
1. ЭТАП 1 Discovery (OSM)
   ↓
   POST INSERT dream_discovery_runs (status='running', source='osm_overpass', niche='X')
   ↓ (получили id=R)
   за каждый найденный node:
     POST INSERT dream_businesses ON CONFLICT canon_key DO UPDATE last_seen_at
   ↓
   UPDATE dream_discovery_runs SET found=N, imported=K, status='success', finished_at=NOW() WHERE id=R

2. ЭТАП 2 Filter
   SELECT * FROM dream_businesses
   WHERE tenant_id='11111111-...-555' AND has_website=0 AND phone IS NOT NULL
     AND yandex_url IS NOT NULL AND enriched_at IS NULL
   LIMIT 20  -- PREMIUM кандидаты

3. ЭТАП 3 Enrichment (Bright Data)
   за каждый кандидат b:
     UPDATE dream_businesses SET enrichment_status='running' WHERE id=b.id
     ↓
     bd_client.fetch(b.yandex_url)  → parse → data.json
     bd_client.fetch(b.yandex_url + 'reviews/') → reviews.json
     bd_client.fetch(b.yandex_url + 'menu/') → services.json
     download photos
     ↓
     compute completeness_score
     ↓ если >= 0.65:
       POST /api/dream/leads/import  body={leads: [data.json]}  →  id=L
       Upload photos в Storage → INSERT dream_lead_photos
       Bulk INSERT dream_lead_reviews
       Bulk INSERT dream_lead_services
       UPDATE dream_businesses SET enriched_at=NOW(), enrichment_status='success', dream_lead_id=L
     ↓ если < 0.65:
       UPDATE dream_businesses SET enrichment_status='failed'

4. ЭТАП 4 Generate landing (SiteFactory — отдельная задача)
   сгенерировать index.html из шаблона + data
   ↓
   Upload в Storage → UPDATE dream_leads SET landing_*, status='generated'

5. Sergey видит на /dream/parser вкладку 3 — кликает → /dream/leads/<slug>
   видит карточку с фото/отзывами/услугами/лендингом → решает делать outreach
```

---

## 5. Идемпотентность — правила

- `dream_businesses.canon_key` UNIQUE → повторный run = UPDATE last_seen_at, не дубли
- `dream_leads.slug` UNIQUE → ON CONFLICT DO UPDATE сохраняет sales fields
- `dream_lead_photos (lead_id, idx)` UNIQUE → перезапись по idx
- `dream_lead_reviews (lead_id, idx)` UNIQUE
- `dream_lead_services (lead_id, idx)` UNIQUE
- Storage: `x-upsert: true` → перезапись файла без ошибки

**Sales workflow поля защищены:** `status`, `notes`, `price`, `contacted_at`, `sold_at`, `done_by`. Парсер их **никогда** не перезаписывает.

---

## 6. Что НЕ делать

❌ Писать в локальный SQLite на маке Sergey'я (он уйдёт скоро).
❌ Хардкодить пути типа `/Users/sergey/Documents/...` в БД (Vercel их не видит).
❌ Класть фото как base64 в БД (только Storage URL).
❌ Удалять чужие строки (status='won' / contacted_at != NULL — это уже Sergey работал).
❌ Использовать `anon_key` Supabase — он read-only для admin tables.
❌ Логировать `SUPABASE_SERVICE_ROLE_KEY` / `AGENT_WEBHOOK_TOKEN` в чат / stdout / git.

---

## 7. Тесты / smoke

После каждого batch-run сверить:
```sql
SELECT
  (SELECT COUNT(*) FROM dream_businesses WHERE tenant_id='11111111-2222-3333-4444-555555555555') AS biz,
  (SELECT COUNT(*) FROM dream_businesses WHERE tenant_id='11111111-2222-3333-4444-555555555555' AND has_website=0) AS no_site,
  (SELECT COUNT(*) FROM dream_leads      WHERE tenant_id='11111111-2222-3333-4444-555555555555') AS leads,
  (SELECT COUNT(*) FROM dream_lead_photos) AS photos,
  (SELECT COUNT(*) FROM dream_lead_reviews) AS reviews,
  (SELECT COUNT(*) FROM dream_lead_services) AS services;
```

Открыть `https://metallportal-crm2.vercel.app/dream/parser` — должны вырасти счётчики вкладок.
Кликнуть конкретного лида → `https://metallportal-crm2.vercel.app/dream/leads/<slug>` → вкладки Фото / Услуги / Отзывы / Лендинг должны быть заполнены.

---

## 8. Quick reference

| Что | Куда |
|---|---|
| Запуск парсера зарегистрирован | `dream_discovery_runs` |
| Discovered бизнес | `dream_businesses` (UNIQUE canon_key) |
| Enriched лид | `dream_leads` (UNIQUE slug) ← **через `POST /api/dream/leads/import`** |
| Фото лида | Storage bucket `dream-landings/<slug>/photos/<NN>.jpg` + `dream_lead_photos` |
| Отзывы | `dream_lead_reviews` |
| Услуги | `dream_lead_services` |
| HTML лендинга | Storage `dream-landings/<slug>/index.html` + `dream_leads.landing_public_url` |
| Sales workflow | `dream_status_history`, `dream_activities` (это Sergey пишет через UI, не парсер) |

---

## 9. Что делать когда непонятно

1. Открой этот файл ещё раз — может покрыто.
2. Открой SPEC `PARSING_PIPELINE_SPEC.md` — там про сам парсинг.
3. Если поле новое — сначала ADD COLUMN миграцией через Cowork-Claude (мозг), потом начни писать.
4. Если не знаешь куда положить новый тип данных — спроси Cowork-Claude (раздел ESCALATION в HANDS_AGENT_PROTOCOL.md).
5. Никогда не выдумывай новые колонки или endpoint'ы — только из этого контракта.

---

_Контракт стабилен. Любые изменения через PR + бамп версии._

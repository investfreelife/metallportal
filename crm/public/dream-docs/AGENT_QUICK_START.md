# 🤖 AGENT QUICK START — Мечта (полная инструкция за 5 минут)

**Версия:** 1.0 (2026-06-18)
**Для:** агента-кодера лендингов, агента-парсера, агента-продавца, любого другого
**Команда чтобы прочитать в любой момент:**

```bash
curl -s https://metallportal-crm2.vercel.app/api/dream/agent-help
```

---

## 0. ПОЧЕМУ ВАШ САЙТ НЕ ПОЯВЛЯЕТСЯ В КАНБАНЕ

Чаще всего ошибки:

| Ошибка | Что делать |
|---|---|
| ❌ Сайт залит в **dream-landings** репо | dream-landings = только сырьё парсера, **готовые сайты идут в `investfreelife.github.io`** |
| ❌ Не вызвал `/api/dream/landings/register` | без этого CRM не знает о сайте |
| ❌ Не перевёл лида в `built` | в канбане производство (`/dream/kanban`) лид останется в «🎨 Производство» |
| ❌ Pre-flight check пропущен | проверь блокеры + build_status='approved' ПЕРЕД работой |
| ❌ Использовал старые URL Supabase Storage | по ЗАКОНУ — фото с Yandex CDN, лендинги на GitHub Pages |

**Правильный workflow ниже.**

---

## 0.5 🚦 ГЛАВНОЕ РЕШЕНИЕ: СТРОИТЬ / В TRASH / ДОРАБОТАТЬ (читать ПЕРВЫМ)

> Боль №1: агент сам видит, что лид мусорный или у него уже есть сайт — но всё равно строит и кладёт в проверку. **Это запрещено.** Если ты сам понял, что строить не надо — НЕ строй и НЕ клади в проверку. Отправь в trash.

**Правило владельца:** перед любой работой спроси себя — «стал бы я, владелец студии, тратить деньги и время, чтобы показать ЭТОТ сайт ЭТОМУ бизнесу?». Нет → trash. Сомнение → comment kind='issue' Сергею, НЕ в проверку.

### Авто-TRASH (НЕ строить, сразу `build_status='trash'` + trash_reason + tag, СТОП):
| Признак | trash_reason | tag |
|---|---|---|
| У бизнеса УЖЕ есть свой сайт (`website_url` не пуст, или нашёл живой домен) | `has_website` | `has-site` |
| Не наша ниша (барбершоп/магазин/опт вместо автосервиса) | `wrong_niche` | `wrong-niche` |
| Не та гео/город | `wrong_city` | — |
| Закрыт / «постоянно закрыто» в Я.Картах | `closed` | `closed` |
| Рейтинг < 4.0 ИЛИ 0 отзывов ИЛИ 0 фото | `low_quality` | — |
| Дубликат (тот же бизнес уже есть) | `duplicate` | — |
| Нет телефона (продавать некому) | `no_phone` | — |

Как отправить в trash (а не в проверку):
```bash
curl -X POST .../api/dream/leads/<slug>/transition -H "x-agent-token: $TOK" -H "x-agent-name: agent:coder" \
  -d '{"to_status":"trash","trash_reason":"has_website","note":"нашёл живой сайт example.ru"}'
# + проставить tag через build-plan/comments
```
Сначала ВСЕГДА прогоняй `auto-classify` (§4.2) — он часть этих кейсов отсекает сам. Но если автомат пропустил, а ты ГЛАЗАМИ видишь мусор — твоя обязанность отправить в trash, не перекладывать на Сергея.

### СТРОИТЬ только если ВСЁ из:
- `build_status='approved'` + `build_plan_json` есть (Сергей утвердил) **И** нет блокеров (pre-flight);
- ниша наша, город наш, бизнес живой, телефон есть, своего сайта нет;
- данных достаточно (фото ≥3, услуги или отзывы есть).

### ДОРАБОТАТЬ / СПРОСИТЬ (не trash, но и не в проверку):
Данных мало, ниша/услуги неясны, отзывы чужие → `comment kind='issue'` Сергею с конкретным вопросом. Лид остаётся на своей стадии, НЕ двигай в review/for_sale.

---

## 1. Базовые координаты

| | Значение |
|---|---|
| CRM URL | `https://metallportal-crm2.vercel.app/dream` |
| Tenant ID (Мечта) | `11111111-2222-3333-4444-555555555555` |
| Supabase URL | `https://tmzqirzyvmnkzfmotlcj.supabase.co` |
| Service-role key | `/Users/Shared/металл/metallportal/.env.local` → `SUPABASE_SERVICE_ROLE_KEY` |
| Agent webhook token | `/Users/Shared/металл/metallportal/.env.local` → `AGENT_WEBHOOK_TOKEN` |
| Parser storage repo | `github.com/investfreelife/dream-landings` (сырьё фото) |
| **Production sites repo** | `github.com/investfreelife/investfreelife.github.io` (готовые лендинги) |

---

## 2. ПРАВИЛО ХРАНЕНИЯ — ЧТО КУДА

```
┌──────────────────────────────┐
│  Yandex CDN (оригиналы фото)  │ → URL хранится в dream_lead_photos.source_url
└──────────────────────────────┘

┌──────────────────────────────┐
│  github.com/.../dream-landings│ → сырьё парсера: webp фото лида + json
│  raw.githubusercontent.com/..│   URL → dream_lead_photos.url
└──────────────────────────────┘

┌──────────────────────────────┐
│  github.com/...investfreelife │ → ГОТОВЫЕ лендинги клиентам (Pages)
│  investfreelife.github.io/... │   URL → dream_landings.entry_url
└──────────────────────────────┘

┌──────────────────────────────┐
│  Supabase Postgres            │ → ТОЛЬКО метаданные, никаких файлов >200KB
└──────────────────────────────┘
```

**ЗАКОН:** ничего тяжёлого в Supabase Storage. Исключение — bucket `dream-comments` для attachments оператора ≤300KB.

---

## 3. PRE-FLIGHT CHECK (обязательно для каждого агента, перед каждым лидом)

```sql
-- 1. Активные блокеры?
SELECT * FROM dream_lead_blockers WHERE lead_id = :lead_id;
-- если ЕСТЬ → STOP, ничего не делать. Лог dream_landing_generations.status='blocked_by_comment'

-- 2. Approval пройден? (для кодера обязательно)
SELECT build_status, build_plan_json FROM dream_leads WHERE id = :lead_id;
-- если build_status != 'approved' → STOP, лог 'blocked_not_approved'
-- если build_plan_json IS NULL → STOP, нет указаний что собирать
```

---

## 4. РОЛИ агентов — кто что делает

### 4.1 Агент-парсер
Парсит бизнес из Я.Карт → пишет в CRM.

```bash
# 1. Скачать фото с Я.Карт (только из <раздел gallery>, не из reviews — там куртки!)
# 2. Конвертировать → webp ≤200KB, max 1200px
# 3. Push в dream-landings repo:
git clone https://github.com/investfreelife/dream-landings
cp /tmp/<slug>/photos/*.webp dream-landings/<slug>/photos/
cp /tmp/<slug>/{data,reviews,services,photos}.json dream-landings/<slug>/
cd dream-landings && git add <slug>/ && git commit -m "<slug>: parsed" && git push

# 4. POST в CRM:
curl -X POST https://metallportal-crm2.vercel.app/api/dream/leads/import \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $AGENT_WEBHOOK_TOKEN" \
  -d '{"leads":[{"slug":"<slug>","name":"...","niche":"...","phone":"+7...",
       "yandex_url":"https://yandex.ru/maps/...","rating":4.4,"reviews_count":110,...}]}'

# 5. Для каждого фото — INSERT в dream_lead_photos через service-role (URL = raw.github)
# 6. После всего — POST на /transition с to_status='enriching' или сразу 'plan_proposed' с build_plan_json
```

### 4.2 Агент-классификатор (фильтр мусора)

```bash
# Прогнать через автомат-фильтр, чтобы Sergey не тратил время на отсев мусора:
curl -X POST https://metallportal-crm2.vercel.app/api/dream/leads/<slug>/auto-classify \
  -H "x-agent-token: $AGENT_WEBHOOK_TOKEN"

# Если is_trash=true — лид сам уйдёт в trash с trash_reason:
#   auto:has_website / auto:wrong_city / auto:low_rating / auto:no_reviews / auto:duplicate
```

### 4.3 Агент-кодер ⭐ САМЫЙ ВАЖНЫЙ — ПОЧЕМУ САЙТ НЕ ПОЯВЛЯЕТСЯ

**ПРАВИЛЬНЫЙ ПУТЬ (5 шагов):**

```bash
# === ШАГ 1: PRE-FLIGHT CHECK ===
# SQL выше. Если красный — STOP.

# === ШАГ 2: ПЕРЕЙТИ В 'building' ===
curl -X POST https://metallportal-crm2.vercel.app/api/dream/leads/<slug>/transition \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $AGENT_WEBHOOK_TOKEN" \
  -H "x-agent-name: agent:coder" \
  -d '{"to_status":"building"}'

# === ШАГ 3: ПОЛУЧИТЬ ДАННЫЕ ЛИДА ===
# - SELECT * FROM dream_leads WHERE slug='<slug>'
# - SELECT * FROM dream_lead_photos WHERE lead_id=:id AND priority=true AND deleted=false ORDER BY idx
# - SELECT * FROM dream_lead_reviews/services WHERE lead_id=:id
# - build_plan_json содержит design_ref/sections/photo_assignments/video/seo

# === ШАГ 4: ГЕНЕРИТЬ И ПУШИТЬ В ПРАВИЛЬНЫЙ РЕПО ===
git clone https://github.com/investfreelife/investfreelife.github.io
cd investfreelife.github.io
mkdir -p <slug>/<variant>-<version>
# Сгенерируй HTML, CSS, скачай фото в assets/photos/*.webp (≤200KB)
# Используй относительные пути в HTML, без хардкодов
git add <slug>/ && git commit -m "<slug>: <variant>-<version>" && git push
# Через 30 сек живёт на https://investfreelife.github.io/<slug>/<variant>-<version>/

# === ШАГ 5: ЗАРЕГИСТРИРОВАТЬ В CRM ===
curl -X POST https://metallportal-crm2.vercel.app/api/dream/landings/register \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $AGENT_WEBHOOK_TOKEN" \
  -d '{
    "lead_slug": "<slug>",
    "variant": "modern",          # или classic/minimal/pro/...
    "version": "v1",
    "template_id": "autoservice_modern_v1",
    "storage_prefix": "https://investfreelife.github.io/<slug>/modern-v1/",
    "pages": [{
      "slug": "index", "title": "Главная",
      "storage_path": "<slug>/modern-v1/index.html"
    }],
    "meta": {"host":"github-pages","repo":"investfreelife.github.io","photos":24}
  }'

# === ШАГ 6: ПЕРЕВЕСТИ В 'built' ===
curl -X POST https://metallportal-crm2.vercel.app/api/dream/leads/<slug>/transition \
  -H "Content-Type: application/json" \
  -H "x-agent-token: $AGENT_WEBHOOK_TOKEN" \
  -H "x-agent-name: agent:coder" \
  -d '{"to_status":"built"}'

# ✅ ТЕПЕРЬ ЛИД ПОЯВИТСЯ:
#   - в /dream/kanban → колонке «🔍 Проверка сайта»
#   - в карточке лида → вкладке «🌐 Лендинг» появится новый вариант
#   - в /dream/board появится после того как Sergey клик «✅ В продажу» (→ for_sale)
```

**Если что-то пошло не так — Sergey не увидит сайт в канбане. Проверь:**
- `SELECT * FROM dream_landings WHERE lead_id=...` — есть запись?
- `SELECT build_status FROM dream_leads WHERE slug='...'` — `built` или дальше?
- Открой `https://investfreelife.github.io/<slug>/<variant>-<version>/` в браузере — есть HTTP 200?

### 4.4 Агент-продавец / звонилка

После каждого звонка пишет в CRM по контракту §7 SPEC:

```sql
-- 1. Upsert dream_calls
INSERT INTO dream_calls (tenant_id, lead_id, conversation_id, status, result, qualification,
                         summary, transcript, duration_sec, recording_url, cost, started_at, ended_at)
VALUES (...);

-- 2. INSERT dream_messages (channel=voice, direction=out, author=ai, body=summary, call_id=...)
INSERT INTO dream_messages (...) VALUES (...);

-- 3. INSERT dream_activities (для таймлайна)
INSERT INTO dream_activities (tenant_id, lead_id, ts, type, actor, title, body, ref_table, ref_id, meta)
VALUES (..., 'call', 'robot', '📞 Звонок 58с ✅', summary, 'dream_calls', call_id, '{...}');

-- 4. UPDATE dream_leads (стадия + контакт + дожим)
UPDATE dream_leads SET
  last_contact_at = NOW(), last_channel = 'voice',
  sales_stage = '<qualified|reached|no_answer|lost>',
  contact_name = ..., contact_position = ..., contact_email = ...,
  decision_maker_name = ..., decision_maker_phone = ...,
  interest = '...',
  next_action_at = ..., next_action_goal = '...', next_action_by = 'robot',
  call_attempts = call_attempts + 1
WHERE id = :lead_id;
```

### 4.5 🗂 ЗАПОЛНЕНИЕ КАРТОЧКИ КЛИЕНТА (обязательно для парсера и кодера)

> Боль №2: карточка пустая. Карточка — лицо лида, заполняй МАКСИМАЛЬНО из того, что спарсил/увидел. Пустое поле = недоработка.

При импорте/обогащении лида заполни в `dream_leads` всё, что есть:
- **Компания:** `name`, `niche`, `city`, `address`, `metro_nearest`, `geo_lat`/`geo_lon`, `yandex_url`, `gis_url`.
- **Контакты:** `phone`, `phone_display`, `email`, `social_json` (вк/telegram/whatsapp если нашёл).
- **Доверие:** `rating`, `ratings_count`, `reviews_count`, `photos_count`, `services_count`.
- **Часы работы:** `hours_json` (`{is_24_7, structured:{mon..sun}, current_status}`) — нужно звонилке (не звонить ночью!).
- **Суть:** `description_short`, `description_long`, `niche`, `features_json`, `ai_summary` (1-2 фразы кто это), `ai_pitch` (чем зацепить на звонке).
- **Сайт клиента:** `website_url` — если у него ЕСТЬ свой сайт, ОБЯЗАТЕЛЬНО записать → это авто-trash (см. §0.5), не строить.
- `completeness_score` — оцени 0..1 полноту; <0.5 → доработать/спросить, не строить.

Контактные поля (`contact_name/position/email`, `decision_maker_*`, `interest`) дозаполняет звонилка по ходу звонков — НЕ затирай их пустыми при ре-парсе (upsert сохраняет sales-поля).

### 4.6 🧹 НЕ ЗАСОРЯЙ вкладку «Лендинг» и канбан

> Боль №3: во вкладке landing лежит мусор, канбан заполнен криво.

- Регистрируй (`/landings/register`) ТОЛЬКО реальный рабочий вариант (открывается, HTTP 200, не чёрный hero, не чужие отзывы). Тестовые/битые/черновые — НЕ регистрировать.
- Один лид = 1-2 осмысленных варианта максимум, не плоди дубли. Старый/битый вариант помечай `deleted`/`superseded`, не оставляй висеть.
- Не оставляй лид «застрявшим» между стадиями: довёл до решения (built / trash / issue) — обнови `build_status`. Канбан должен отражать реальность.
- Не двигай в `for_sale` сам — это решение Сергея (кнопка «✅ В продажу»). Твоя зона — довести до `built` чистым.

---

## 5. API endpoints — REFERENCE

| Endpoint | Метод | Auth | Зачем |
|---|---|---|---|
| `/api/dream/leads/import` | POST | x-agent-token | Парсер: bulk upsert лидов |
| `/api/dream/leads/[slug]/photos/[idx]` | PATCH | cookie | Sergey: ⭐ priority / 🗑 deleted |
| `/api/dream/leads/[slug]/comments` | POST | both | Заметки + фото upload |
| `/api/dream/leads/[slug]/build-plan` | GET/PATCH | both | План + статус (approved только Sergey) |
| `/api/dream/leads/[slug]/transition` | POST | both | Production воронка (build_status) |
| `/api/dream/leads/[slug]/stage` | POST | both | Sales воронка (sales_stage) |
| `/api/dream/leads/[slug]/auto-classify` | POST | both | Автомат-фильтр мусора |
| **`/api/dream/landings/register`** | **POST** | **x-agent-token** | **Кодер: регистрация готового сайта** |
| `/api/dream/landings/[id]/chosen` | POST | cookie | Sergey: выбор активного варианта |
| `/api/dream/leads/[slug]/timeline` | GET | cookie | Лента касаний |
| `/api/dream/calls` | GET | cookie | Журнал звонков + KPI |
| `/api/dream/calls/[id]` | GET | cookie | Lazy расшифровка |

---

## 6. ВОРОНКИ — две

**Производство** (`build_status`, канбан `/dream/kanban`):
```
parsed → enriching → plan_proposed → approved → building → built →
review_built → for_sale → selling → sold | lost | trash
```

**Продажа** (`sales_stage`, канбан `/dream/board`):
```
site_ready → to_call → no_answer → reached → qualified →
link_sent → negotiating → callback → won | lost | disqualified
```

---

## 7. ЖЁСТКИЕ ПРАВИЛА (нарушение = бан)

1. **Pre-flight check** перед любой работой.
2. **Никаких файлов >200 KB в Supabase Storage** (исключение dream-comments 300KB).
3. **Yandex CDN URL для оригиналов** фото лидов, не качать в Supabase.
4. **WebP** для фото в репо. JPG/PNG → fail CI.
5. **Относительные ссылки** в HTML лендингов.
6. **Без выдумок** (годы работы, акции). Только из CRM.
7. **`build_status='approved'` обязателен** для агента-кодера. Иначе STOP.
8. **set_chosen / approved / is_resolved (блокеры)** = только Sergey.
9. **Override блокера** только через `reason` со словом «override».
10. **Секреты только в `/Users/Shared/металл/`** (+ `metallportal/.env.local`). Не в git, не в чат.
11. **Сам увидел мусор/свой сайт/не та ниша → TRASH, НЕ в проверку** (§0.5). Не перекладывать отсев на Сергея.
12. **Карточку заполнять максимально** (§4.5). Пустые поля при наличии данных = недоработка.
13. **В проверку/продажу — только то, что сам показал бы клиенту.** Битые сайты, чужие отзывы, подменённая ниша — не регистрировать и не двигать дальше (§4.6).

---

## 8. КОРОТКАЯ КОМАНДА АГЕНТА

Всегда начинай работу с:
```bash
curl -s https://metallportal-crm2.vercel.app/api/dream/agent-help
```

Это вернёт plain-text эту инструкцию. Сверяйся.

Альтернатива (через UI): https://metallportal-crm2.vercel.app/dream/docs/AGENT_QUICK_START

---

## 9. ЕСЛИ ЗАСТРЯЛ

1. Открой `/dream/docs` в CRM — там все доки
2. Прочитай `ARCHITECTURE.md` — общая картина
3. Прочитай `CRM_DATA_CONTRACT.md` — детали БД
4. Прочитай `LANDING_FACTORY_AGENT_GUIDE.md` — детали для кодера
5. Свежие отчёты в `app/queue/REPORTS/`
6. Спроси Sergey'я через комментарий с kind='issue' к лиду — он увидит

---

_Инструкция стабильна. При изменении архитектуры — обновляем этот файл._

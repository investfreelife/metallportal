# MASTER.md — Полная техническая документация проекта
## Harlan Steel / МеталлПортал
*Последнее обновление: 26 апреля 2026 | Версия 3.0*

> **ТОЧКА ВХОДА ДЛЯ ЛЮБОГО АГЕНТА ИЛИ РАЗРАБОТЧИКА.**
> Этот файл содержит ВСЁ: стратегию, архитектуру, реализацию, статус, планы.
> Перед любой работой — прочитать полностью. После любой задачи — обновить раздел "Статус".

---

## 1. ЧТО ЗА ПРОЕКТ

### Бизнес-идея
**Harlan Steel** — российский B2B/B2C маркетплейс металлопроката с AI-ассистентом,
который понимает запросы на живом языке ("нужна труба профильная 60×60 метров 40"),
считает стоимость, формирует коммерческое предложение и ведёт сделку до победы.

Проект сочетает три части:
1. **Публичный сайт** — каталог 12 166 товаров, калькуляторы, AI-поиск, корзина
2. **AI CRM** — управление лидами, сделками, задачами с автоматизацией через AI
3. **AI-микросервис** — мозг всей системы: скоринг, КП, контент, утренние брифы

### Бизнес-цели
- Продавать металлопрокат онлайн (B2B: стройки, производства; B2C: частники)
- Принимать заявки через сайт → автоматически квалифицировать лиды
- Генерировать КП через AI за секунды вместо часов
- Отправлять утренний бриф руководителю в Telegram каждый день в 9:00
- В будущем — SaaS платформа для других металлоторговых компаний

### URL и репозитории
| Компонент | URL | Репозиторий |
|---|---|---|
| Публичный сайт | https://www.harlansteel.ru | github.com/investfreelife/metallportal |
| CRM | https://metallportal-crm2.vercel.app | тот же монорепозиторий (`crm/`) |
| AI микросервис | https://harlan-ai-production-production.up.railway.app | github.com/investfreelife/harlan-ai |

---

## 2. ФИЗИЧЕСКАЯ СТРУКТУРА ПРОЕКТА

```
/Users/sergey/Desktop/металл/
├── metallportal/          ← ГЛАВНЫЙ РЕПОЗИТОРИЙ (Next.js сайт + CRM)
│   ├── app/               ← Публичный сайт (Next.js App Router)
│   ├── components/        ← React компоненты
│   ├── contexts/          ← CartContext, CatalogFiltersContext
│   ├── hooks/             ← useProductPrice
│   ├── lib/               ← Supabase клиент, запросы, утилиты
│   ├── crm/               ← CRM приложение (Next.js 16, порт 3002)
│   ├── mobile/            ← Мобильное приложение (Expo)
│   ├── docs/              ← Документация (ты здесь)
│   ├── scripts/           ← Утилиты (импорт, SEO генерация)
│   ├── supabase/          ← SQL миграции
│   └── data/              ← catalog_full.json (12 166 товаров)
│
└── harlan-ai/             ← AI МИКРОСЕРВИС (отдельный репозиторий)
    └── src/harlan_ai/
        ├── config.py      ← ЕДИНСТВЕННЫЙ источник LLM конфига
        ├── tasks.py       ← ВСЕ AI задачи (1 функция = 1 вызов = известная цена)
        ├── main.py        ← FastAPI сервер
        ├── crews/         ← CrewAI агенты (для сложных задач)
        └── tools/         ← Инструменты (Supabase, Telegram, поиск)
```

---

## 3. ТЕХНИЧЕСКИЙ СТЕК

### Публичный сайт (metallportal)
| Слой | Технология | Версия |
|---|---|---|
| Фреймворк | Next.js App Router | 14.2.3 |
| Язык | TypeScript | ^5.3.3 |
| Стили | Tailwind CSS | ^3.4.1 |
| БД | Supabase (PostgreSQL) | ^2.39.0 |
| Иконки | Lucide React | ^1.8.0 |
| Темы | next-themes | ^0.4.6 |
| Фото AI | fal.ai | ^1.9.5 |
| Деплой | Vercel (автодеплой из main) | — |

### CRM (crm/)
| Слой | Технология | Версия |
|---|---|---|
| Фреймворк | Next.js App Router | 16 |
| Язык | TypeScript | — |
| Стили | Tailwind CSS | v4 |
| Состояние | Zustand | — |
| Запросы | TanStack Query | — |
| Email | Resend | — |
| Деплой | Vercel (автодеплой) | — |

### AI микросервис (harlan-ai)
| Слой | Технология |
|---|---|
| Язык | Python 3.12 |
| API сервер | FastAPI + Uvicorn |
| AI агенты | CrewAI 1.12 (для сложных crew-задач) |
| LLM клиент | openai SDK → OpenRouter |
| БД клиент | supabase-py |
| HTTP клиент | httpx |
| Деплой | Railway (Docker) |

---

## 4. БАЗА ДАННЫХ (Supabase)

### Supabase проект
- **URL**: `https://tmzqirzyvmnkzfmotlcj.supabase.co`
- **RLS**: включён на всех таблицах, доступ по `tenant_id`
- **Tenant ID по умолчанию**: `a1000000-0000-0000-0000-000000000001`

### Схема таблиц

```sql
-- ─── КАТАЛОГ ──────────────────────────────────────────
products
  id uuid PK
  name text               -- "Арматура кл А500 ⌀12 мм ГОСТ 5781-82"
  slug text UNIQUE
  article text
  description text
  gost text               -- "ГОСТ 5781-82"
  steel_grade text        -- "A500С"
  unit text               -- "т", "м", "кг", "шт", "м²"
  weight_per_meter numeric -- кг/м (для калькуляторов)
  image_url text
  category_id uuid FK → categories
  seo_title text          -- SEO title (генерируется AI)
  seo_description text    -- SEO meta description
  seo_text text           -- длинный SEO текст
  created_at timestamptz

categories
  id uuid PK
  name text
  slug text
  parent_id uuid FK (NULL = корень)
  level int (1=корень, 2=подкатегория, 3=листовая)
  is_active bool
  sort_order int
  image_url text
  description text

price_items
  id uuid PK
  product_id uuid FK → products
  supplier_id uuid FK → suppliers
  base_price numeric      -- цена за единицу unit (₽)
  discount_price numeric
  in_stock bool
  stock_quantity numeric
  updated_at timestamptz

suppliers
  id uuid PK
  name text               -- "Металл Комплект"
  slug text

-- ─── CRM ──────────────────────────────────────────────
contacts
  id uuid PK
  tenant_id uuid
  name text
  company text
  phone text
  email text
  source text             -- "site", "telegram", "manual"
  ai_score int (0-100)    -- скоринг лида от AI
  ai_segment text         -- "hot"/"warm"/"cold"
  ai_next_action text     -- следующее действие
  telegram_chat_id bigint
  created_at timestamptz

deals
  id uuid PK
  tenant_id uuid
  contact_id uuid FK → contacts
  title text
  amount numeric          -- сумма сделки ₽
  stage text              -- "new"/"qualified"/"proposal"/"negotiation"/"won"/"lost"
  created_at timestamptz

activities
  id uuid PK
  tenant_id uuid
  contact_id uuid FK → contacts
  type text               -- "call"/"email"/"note"/"meeting"
  subject text
  body text
  created_at timestamptz

ai_queue                  -- очередь задач AI (менеджер подтверждает/отклоняет)
  id uuid PK
  tenant_id uuid
  contact_id uuid FK
  deal_id uuid FK
  action_type text        -- "send_proposal"/"send_message"/"call_client"
  priority text           -- "urgent"/"high"/"normal"/"low"
  subject text
  content text            -- сгенерированный текст (КП, письмо, пост)
  ai_reasoning text       -- объяснение решения AI
  status text             -- "pending"/"approved"/"rejected"/"snoozed"
  created_at timestamptz

ai_cost_log               -- лог всех вызовов AI (биллинг)
  id uuid PK
  tenant_id uuid
  agent_name text         -- "bezos"/"seller"/"smm"/"search"/"secretary"
  task_name text          -- "morning_brief"/"score_lead"/"generate_kp"
  model text              -- "qwen/qwen3.6-plus"
  model_short text        -- "qwen3.6-plus"
  input_tokens int
  output_tokens int
  total_tokens int
  input_cost_usd numeric
  output_cost_usd numeric
  total_cost_usd numeric
  success bool
  error_message text
  duration_ms int
  contact_id uuid FK
  created_at timestamptz

-- ─── КОММУНИКАЦИИ ──────────────────────────────────────
social_posts
  id uuid PK
  tenant_id uuid
  platform text           -- "telegram"/"vk"/"instagram"
  content text
  status text             -- "draft"/"published"
  published_at timestamptz

calls
  id uuid PK
  tenant_id uuid
  contact_id uuid FK
  duration_sec int
  transcript text         -- Whisper транскрипция
  summary text            -- AI саммари
  sentiment text
  quality_score int (0-100)
  created_at timestamptz

-- ─── ТРЕКИНГ ──────────────────────────────────────────
events                    -- события на сайте (page_view, phone_click и др.)
  id uuid PK
  tenant_id uuid
  contact_id uuid FK
  event_type text
  url text
  metadata jsonb
  created_at timestamptz

-- ─── СИСТЕМНОЕ ────────────────────────────────────────
site_settings             -- key-value настройки сайта
tenant_settings           -- настройки CRM (API ключи, токены)
admin_users               -- аутентификация (общая для сайта и CRM)
agent_memory              -- память агентов (последние запуски)
orders                    -- заказы из корзины сайта
```

### RPC функции
- `get_product_counts()` — рекурсивный счётчик товаров по категориям (обходит лимит 1000)

---

## 5. AI МИКРОСЕРВИС — harlan-ai

### Философия архитектуры
**v3.0 Принцип**: `1 функция = 1 LLM вызов = известная стоимость`

Никаких агентов разговаривающих друг с другом без необходимости.
CrewAI используется только когда нужно итеративное мышление (Document parsing).
Все остальные задачи — прямые вызовы через `tasks.py` → `call_llm()`.

### PII-правило маршрутизации моделей
```
БЕЗ данных клиентов (нет PII) → qwen/qwen3.6-plus (бесплатно, $0.00)
С данными клиентов (есть PII) → qwen/qwen3.5-flash-02-23 (~$0.065/M токенов)
```

**Логика**: Qwen3.6 Plus — бесплатная модель, но собирает данные промптов.
Для системных задач (бриф, посты, стратегия) — допустимо. Для имён/телефонов — нет.

### Модели (Railway Variables)
| Переменная | Значение | Цена | Когда |
|---|---|---|---|
| `MODEL_BEZOS` | `qwen/qwen3.6-plus` | $0.00 | Утренний бриф, стратегия |
| `MODEL_ORCHESTRATOR` | `qwen/qwen3.6-plus` | $0.00 | Оркестрация (нет PII) |
| `MODEL_SMM` | `qwen/qwen3.6-plus` | $0.00 | Посты, контент |
| `MODEL_SCOUT` | `qwen/qwen3.6-plus` | $0.00 | Разведка без PII |
| `MODEL_SEARCH` | `qwen/qwen3-8b` | $0.06/M | Поиск металлопроката |
| `MODEL_WORKER` | `qwen/qwen3.5-flash-02-23` | $0.065/M | КП, скрипты с PII |
| `MODEL_CHEAP` | `qwen/qwen3.5-flash-02-23` | $0.065/M | Скоринг, классификация |
| `MODEL_SELLER` | `qwen/qwen3.5-flash-02-23` | $0.065/M | Продавец |
| `MODEL_ANALYST` | `qwen/qwen3.5-flash-02-23` | $0.065/M | Аналитика |

### Fallback цепочка
```
qwen/qwen3.6-plus  → (если пусто/ошибка) → qwen/qwen3.5-flash-02-23
qwen/qwen3-8b      → (если пусто/ошибка) → qwen/qwen3.5-flash-02-23
qwen/qwen3.5-35b-a3b → qwen/qwen3-8b
```

**ВАЖНО**: Qwen3 модели работают в "thinking mode" — `content` может быть `None`.
В `call_llm()` реализован retry: пустой ответ = переход к fallback.
Также передаётся `extra_body={"reasoning": {"exclude": True}}` для отключения reasoning.

### config.py — единственная истина

```python
# Файл: harlan-ai/src/harlan_ai/config.py
# ВСЕ модели берутся отсюда, НЕ захардкожены в tasks.py

def call_llm(model, system, user, max_tokens=800) -> tuple[str, int, int, str]:
    """
    Единственная точка вызова LLM.
    Возвращает: (текст, input_tokens, output_tokens, использованная_модель)
    - Автоматический fallback если модель вернула пустой ответ
    - 30s timeout
    - reasoning: exclude для отключения thinking mode Qwen3
    """
```

### tasks.py — все AI задачи

```python
# Файл: harlan-ai/src/harlan_ai/tasks.py
# Правило: одна функция = один LLM вызов = известная стоимость

def _llm(model, system, user, max_tokens, agent, task, contact_id=None) -> str:
    """Все вызовы LLM идут через эту функцию. Автологирование в ai_cost_log."""

def search_metal(query, context=None) -> dict:
    """qwen3-8b · Поиск металлопроката. Возвращает JSON с items[], total_price."""

def score_lead(contact) -> dict:
    """qwen3.5-flash · PII! · Скоринг нового лида. JSON: {score, segment, next_action}"""

def generate_kp(name, company, request, contact_id) -> str:
    """qwen3.5-flash · PII! · Коммерческое предложение."""

def generate_call_script(name, company, goal, contact_id) -> str:
    """qwen3.5-flash · PII! · Скрипт телефонного звонка."""

def generate_post(platform, topic) -> str:
    """qwen3.6-plus · FREE · Пост для соцсетей. Сохраняет в social_posts."""

def classify_email(subject, sender, body) -> dict:
    """qwen3.5-flash · PII! · Классификация входящего письма."""

def morning_brief() -> str:
    """qwen3.6-plus · FREE · Утренний бриф из БД → Telegram менеджеру."""

def bezos_answer(question) -> str:
    """qwen3.6-plus · FREE · Стратегический ответ на вопрос руководителя."""
```

### main.py — FastAPI эндпоинты

```
POST /api/webhook/contact-created  ← Supabase триггер при новом контакте → score_lead()
POST /api/webhook/deal-won         ← Supabase триггер → Telegram уведомление
POST /api/webhook/task-approved    ← Менеджер одобрил задачу → publish в канал

POST /api/cron/morning             ← Vercel Cron в 9:00 МСК → morning_brief()

POST /api/search                   ← AI поиск металлопроката (сайт вызывает)
POST /api/search/voice             ← Голосовой поиск (Whisper → текст → search)
POST /api/documents/parse          ← Загрузка сметы PDF/DOCX/XLSX → КП
POST /api/agents/bezos/ask         ← Вопрос CEO агенту из CRM
POST /api/agents/bezos/morning     ← Ручной запуск утреннего брифа
POST /api/content/post             ← Генерация поста из CRM
POST /api/agents/sales/kp          ← Генерация КП из CRM → в ai_queue

GET  /api/costs/openrouter         ← Сверка нашего лога с OpenRouter (биллинг)
GET  /health                       ← Проверка: версия, модели, telegram, supabase
```

**Аутентификация**: заголовок `X-API-Key` (Railway var `API_SECRET_KEY`)
**Cron аутентификация**: заголовок `X-Cron-Secret` (Railway var `CRON_SECRET`)

### crews/ — CrewAI агенты (для сложных задач)

Crews используются только когда нужен итеративный диалог между агентами.
**Статус**: большинство crews заменены на прямые вызовы в tasks.py из-за несовместимости
Qwen3 с tool-calling форматом CrewAI.

| Файл | Статус | Назначение |
|---|---|---|
| `bezos_crew.py` | Работает (legacy) | Утренний/еженедельный бриф (заменён tasks.morning_brief) |
| `sales_crew.py` | Работает (legacy) | Ежедневный цикл продаж |
| `search_crew.py` | Частично | `run_voice_search()` работает; `run_metal_search()` ЗАМЕНЁН на tasks.search_metal |
| `document_crew.py` | Работает | Парсинг смет (OCR + CrewAI) |
| `content_crew.py` | Работает (legacy) | Ежедневный контент |

---

## 6. ПУБЛИЧНЫЙ САЙТ (metallportal)

### Структура страниц

```
/                     — Главная (Hero + SmartSearch + CategoryRow + CTA)
/catalog/             — Каталог (sidebar + продукты)
/catalog/[cat]/       — Категория уровня 1
/catalog/[cat]/[sub]/ — Категория уровня 2 + товары
/tools/               — Калькуляторы (5 штук)
/cart/                — Корзина
/search/              — Текстовый поиск
/about/               — О компании
/account/             — Личный кабинет (ЗАГОТОВКА)
/admin/               — Админка (6 страниц)
```

### SmartSearch — главная фича сайта

Компонент `components/SmartSearch.tsx` — 4 шага:

```
Шаг 1: Поиск (текст или голос) → POST /api/ai/search → Railway AI
Шаг 2: Корзина результатов (редактирование quantity +/-)
Шаг 3: Форма контактов (имя, телефон, email)
Шаг 4: Успех → создаётся сделка в CRM
```

**Ценообразование**: AI возвращает `items[]` с полями:
- `unit`: "тонн" / "метров" / "штук" — в ТЕХ же единицах что просил клиент
- `price_per_unit`: ₽ за ТУ же единицу (не путать тонны с метрами!)
- `total_price = quantity × price_per_unit`

**Типичная ошибка**: если AI использует цену ₽/т и множит на метры → результат в 100× больше.
В `_SEARCH_SYS` системном промпте есть явная таблица весов (кг/м) и цен (₽/м) для труб.

### API маршруты сайта

```
GET  /api/search                  ← Текстовый поиск товаров (ILIKE)
POST /api/ai/search               ← AI поиск → Railway AI (/api/search)
POST /api/orders/create           ← Создание заказа из SmartSearch → CRM webhook
POST /api/contact                 ← Форма обратной связи → CRM webhook
POST /api/generate-image          ← Генерация фото через fal.ai
GET  /api/popular-products        ← Топ-4 товара для главной
GET  /sitemap.xml                 ← Динамический sitemap (app/sitemap.ts)
```

### Маршрут /api/ai/search (критически важный)

`app/api/ai/search/route.ts`:
1. Принимает `{ query, context }`
2. Проксирует на Railway: `POST ${AI_BASE}/api/search`
3. Timeout: **52 секунды** (Vercel maxDuration=55)
4. Нормализует ответ через `normalizeResponse()`
5. Если items пустые → `fallbackSearch()` (keyword-based из hardcoded цен)
6. Если Railway недоступен → то же fallback

### Калькуляторы (/tools)

| Калькулятор | Файл | Логика |
|---|---|---|
| Вес металла | `WeightCalc.tsx` | `weightPerMeter(type, dims) × length / 1000` → тонны → ₽ |
| Фундамент | `FoundationCalc.tsx` | Длина арматуры × кг/м → тонны |
| Сетка | `MeshCalc.tsx` | Площадь × шаг → количество прутков → тонны |
| Раскрой листа | `SheetCalc.tsx` | Детали/лист → кол-во листов → вес → ₽ |
| Смета | `EstimateCalc.tsx` | Добавление позиций → итог по весу |

`lib/metalCalc.ts` — формулы веса по ГОСТ:
- `weightPerMeter(type, dims)` — принимает тип и размеры, возвращает кг/м
- Поддерживаемые типы: armatura, krug, kvadrat, shestigr, truba_round, truba_profile, balka, shveller, ugolok, polosa, list
- Справочные таблицы: `ARMATURA[]`, `BALKA[]`, `SHVELLER[]` (кг/м по номеру)

**Расчёт цены** (`hooks/useProductPrice.ts → calcTotalRub`):
- Единица "т" → `price × tons`
- Единица "м" / "м.п." → `price × meters`  
- Единица "кг" → `price × tons × 1000`

### Корзина (CartContext)

`contexts/CartContext.tsx` — localStorage, ключ `cart`:
```typescript
interface CartItem {
  id: string
  name: string
  slug: string
  unit: string      // "т", "м" и т.д.
  price: number     // цена за единицу
  image_url: string | null
  tons?: number     // количество в тоннах
  meters?: number   // количество в метрах
  quantity: number  // количество в единицах unit
}
```

### Трекинг

`crm/public/track.js` подключён на сайте в `app/layout.tsx`:
```html
<script src="https://metallportal-crm2.vercel.app/track.js?tid=a1000000-..." defer>
```

События: `page_view (+2 балла)`, `phone_click (+15)`, `add_to_cart (+25)`, `form_submit (+30)`
→ накапливаются в `ai_score` контакта

---

## 7. AI CRM (crm/)

### Структура страниц CRM

```
/dashboard     — Дашборд: воронка, KPI, каналы трафика, realtime
/contacts      — Список контактов (таблица, фильтры, AI Score)
/contacts/[id] — Карточка контакта (история, сделки, задачи)
/deals         — Kanban доска (new → won)
/deals/[id]    — Детали сделки
/queue         — AI Queue (одобрить/отклонить/отложить задачи)
/calls         — Звонки (Whisper анализ)
/campaigns     — Контент-машина (генерация + публикация постов)
/costs         — Расходы AI (детальный лог + сверка с OpenRouter)
/bezos         — Бизнес-ассистент (вопросы CEO)
/channels      — Каналы коммуникации
/analytics     — Аналитика
/settings      — Настройки (интеграции, команда, Telegram)
/emails        — Email (Resend)
```

### API маршруты CRM

```
POST /api/auth/login               ← Логин (admin_users + cookie crm_session)
POST /api/webhook                  ← Приём заказов/заявок с сайта
POST /api/track                    ← Приём событий трекинга
GET  /api/contacts                 ← Список контактов
POST /api/contacts                 ← Создать контакт
GET  /api/contacts/[id]            ← Контакт по ID
POST /api/contacts/[id]/activity   ← Добавить активность к контакту
GET  /api/deals                    ← Список сделок
PATCH /api/deals/[id]              ← Обновить сделку
GET  /api/ai/queue                 ← Очередь задач
PATCH /api/ai/queue/[id]/[action]  ← approve/reject/snooze
POST /api/social/generate          ← Генерация поста (→ harlan-ai)
POST /api/social/publish           ← Публикация в Telegram канал
POST /api/calls/analyze            ← Анализ звонка (Whisper + GPT)
GET  /api/costs                    ← Данные расходов из ai_cost_log
POST /api/bezos/ask                ← Вопрос CEO агенту (→ harlan-ai)
POST /api/cron/morning             ← Ручной запуск утреннего брифа
GET  /api/settings                 ← Настройки CRM
POST /api/settings                 ← Сохранить настройки
POST /api/team/invite              ← Пригласить менеджера
GET  /api/telegram/status          ← Статус Telegram бота
POST /api/telegram/setup           ← Подключить webhook бота
```

### Авторизация CRM

- Таблица `admin_users` (та же что на сайте)
- HTTP-only cookie `crm_session`
- `proxy.ts` — Edge Runtime, проверяет cookie на каждый приватный маршрут
- Публичные маршруты: `/login`, `/join`, `/api/*` (внутренняя авторизация в каждом route)

### AI Queue — принцип работы

1. AI генерирует задачу (КП, письмо, пост) → записывает в `ai_queue` со `status=pending`
2. Менеджер видит карточку с кнопками: ✅ Одобрить / ✏️ Редактировать / ❌ Отклонить / ⏰ Отложить
3. При одобрении — задача выполняется (отправляется письмо, публикуется пост)
4. Telegram бот присылает те же кнопки менеджеру в личку

### Дашборд расходов AI (/costs)

`CostsDashboard.tsx` показывает:
- По агентам: bezos / seller / smm / search / secretary
- По моделям: с цветовой кодировкой (зелёный = qwen3.6-plus FREE, жёлтый = qwen3.5-flash)
- Детальный лог каждого вызова (клик = раскрытие)
- Кнопка "Сверка с OpenRouter" → вызывает `/api/costs/reconcile` → `harlan-ai/api/costs/openrouter`
- Стоимость $0 отображается как "🆓 FREE"

---

## 8. СРЕДА РАЗРАБОТКИ И ДЕПЛОЙ

### Переменные окружения

#### metallportal (Vercel)
```env
NEXT_PUBLIC_SUPABASE_URL=https://tmzqirzyvmnkzfmotlcj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       ← для API маршрутов (обходит RLS)
OPENROUTER_API_KEY=...              ← SEO генерация скриптами
FAL_KEY=...                         ← генерация фото (fal.ai)
NEXT_PUBLIC_AI_URL=https://harlan-ai-production-production.up.railway.app
NEXT_PUBLIC_AI_KEY=harlan_steel_ai_2024_secret_key_xK9mP3nQ
AI_API_KEY=harlan_steel_ai_2024_secret_key_xK9mP3nQ
CRON_SECRET=...                     ← для Vercel Cron → Railway
TELEGRAM_BOT_TOKEN=...
TELEGRAM_MANAGER_CHAT_ID=...
```

#### CRM (Vercel, отдельный проект)
```env
NEXT_PUBLIC_SUPABASE_URL=...        ← та же БД
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=...
OPENAI_API_KEY=...                  ← для Whisper транскрипции
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_ID=...             ← канал для публикации постов
CRM_MANAGER_TG_ID=...
RESEND_API_KEY=...                  ← для email
AI_BASE_URL=https://harlan-ai-production-production.up.railway.app
HARLAN_AI_KEY=harlan_steel_ai_2024_secret_key_xK9mP3nQ
```

#### harlan-ai (Railway)
```env
OPENROUTER_API_KEY=sk-or-v1-...
SUPABASE_URL=https://tmzqirzyvmnkzfmotlcj.supabase.co
SUPABASE_SERVICE_KEY=...
TENANT_ID=a1000000-0000-0000-0000-000000000001
API_SECRET_KEY=harlan_steel_ai_2024_secret_key_xK9mP3nQ
CRON_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_MANAGER_CHAT_ID=...
TELEGRAM_CHANNEL_ID=...
ENABLE_CRON=true
MODEL_BEZOS=qwen/qwen3.6-plus
MODEL_ORCHESTRATOR=qwen/qwen3.6-plus
MODEL_SMM=qwen/qwen3.6-plus
MODEL_SCOUT=qwen/qwen3.6-plus
MODEL_SEARCH=qwen/qwen3-8b
MODEL_WORKER=qwen/qwen3.5-flash-02-23
MODEL_CHEAP=qwen/qwen3.5-flash-02-23
MODEL_SELLER=qwen/qwen3.5-flash-02-23
MODEL_ANALYST=qwen/qwen3.5-flash-02-23
```

### Деплой

#### Сайт + CRM (Vercel)
```bash
# Из корня metallportal/ — деплой сайта
git add -A && git commit -m "описание" && git push origin main
# Vercel автодеплой: ~2-4 минуты

# Из crm/ — деплой CRM
npx vercel --prod --yes
```

#### AI микросервис (Railway)
```bash
# Из harlan-ai/
git add -A && git commit -m "описание" && git push
railway up --detach      # деплой без ожидания
railway logs             # логи
railway variables list   # переменные
```

### Локальный запуск
```bash
# Сайт
cd metallportal && npm install && npm run dev  # → localhost:3000

# CRM
cd metallportal/crm && npm install && npm run dev -- --port 3002  # → localhost:3002

# AI микросервис
cd harlan-ai
cp .env.example .env && nano .env  # заполнить ключи
uv venv && uv pip install -e .
uvicorn src.harlan_ai.main:app --reload  # → localhost:8000
```

---

## 9. ПОТОК ДАННЫХ (DATA FLOW)

### Сценарий 1: Клиент ищет металл на сайте

```
Клиент вводит "труба 60×60 50 метров"
  ↓
components/SmartSearch.tsx
  ↓ POST /api/ai/search (Next.js route)
  ↓ + timeout 52s, fallback keyword если Railway недоступен
  ↓
Railway: POST /api/search
  ↓ tasks.search_metal(query)
  ↓ call_llm(MODEL_SEARCH="qwen/qwen3-8b")
  ↓ промпт: системный специалист по металлу + таблица цен/весов
  ↓ LLM возвращает JSON {items[], total_price, recommendation}
  ↓ Логируется в ai_cost_log (agent="search")
  ↓
SmartSearch показывает карточки с позициями
Клиент редактирует количество → total_price пересчитывается локально
  ↓
POST /api/orders/create
  ↓ Создаёт контакт в БД (или находит существующий)
  ↓ Создаёт сделку deals (stage="new")
  ↓ Создаёт задачу ai_queue (action_type="score_lead")
  ↓ POST harlan-ai/api/webhook/contact-created (в фоне)
  ↓ → score_lead() → обновляет contacts.ai_score
  ↓ Telegram уведомление менеджеру
```

### Сценарий 2: Утренний бриф (9:00 МСК)

```
Vercel Cron: POST /api/cron/trigger-agents (vercel.json)
  ↓ HTTP → Railway: POST /api/cron/morning (X-Cron-Secret)
  ↓ ENABLE_CRON=true → morning_brief() в background
  ↓
tasks.morning_brief():
  1. Читает БД (без LLM): горячие лиды, pipeline, выручка, очередь
  2. call_llm(MODEL_BEZOS="qwen/qwen3.6-plus") → форматированный бриф
  3. _tg(brief, "manager") → Telegram менеджеру
  4. Логируется в ai_cost_log (agent="bezos", cost=$0.00)
```

### Сценарий 3: Менеджер заказывает КП из CRM

```
CRM /contacts/[id] → кнопка "Генерировать КП"
  ↓ POST /api/agents/sales/kp {contact_name, company, request}
  ↓
Railway: tasks.generate_kp(name, company, request, contact_id)
  ↓ call_llm(MODEL_WORKER="qwen/qwen3.5-flash-02-23")  ← PII!
  ↓ Логируется в ai_cost_log (agent="seller", contact_id=...)
  ↓
Сохраняется в ai_queue (status="pending", action_type="send_proposal")
  ↓
Менеджер видит КП в /queue → одобряет → email клиенту
```

---

## 10. СТАТУС ЗАДАЧ

### ✅ Работает (апрель 2026)

| Компонент | Статус |
|---|---|
| Каталог 12 166 товаров | ✅ |
| Цены (price_items) | ✅ |
| SmartSearch → CRM | ✅ |
| AI поиск (qwen3-8b) | ✅ Работает, ~20-40 сек |
| Калькуляторы (5 штук) | ✅ |
| Утренний бриф 9:00 МСК | ✅ |
| Скоринг лидов | ✅ |
| Генерация КП | ✅ |
| Генерация постов (free) | ✅ |
| Telegram бот | ✅ |
| Трекинг (track.js) | ✅ |
| CRM дашборд | ✅ |
| AI Queue | ✅ |
| Расходы AI (ai_cost_log) | ✅ |
| Сверка с OpenRouter | ✅ |
| SEO метатеги | ✅ (11 095 / 12 166) |
| Sitemap динамический | ✅ |

### ⚠️ Требует внимания

| Компонент | Проблема |
|---|---|
| Скорость AI поиска | 20-40 сек — на грани timeout |
| SEO seo_text | Не сгенерированы (только title+desc) |
| Фото товаров | FAL_KEY не добавлен |

### 📋 Следующие задачи (по приоритету)

1. **Личный кабинет** (`/account/profile`, история заказов, избранное)
2. **Ускорить AI поиск** — кэширование частых запросов, меньшие модели
3. **SEO тексты** — seo_text для ~12 166 товаров (продолжение скрипта)
4. **Фото товаров** через fal.ai (добавить FAL_KEY)
5. **Кабинет поставщика** (`/supplier/`)
6. **Телефония** — Voximplant + Whisper (CRM Phase 5)
7. **WhatsApp** (CRM Phase 4)
8. **n8n оркестратор** (планируется для автоматизации)

---

## 11. ИЗВЕСТНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: Qwen3 thinking mode → пустой content
**Суть**: Qwen3 модели по умолчанию работают в режиме внутренних рассуждений.
OpenRouter возвращает ответ с `choices[0].message.content = None`.

**Решение** в `config.py`:
- `extra_body={"reasoning": {"exclude": True}}` — пытается отключить reasoning
- Если `text` пустой → `last_error = ValueError(...)` → продолжаем к fallback
- Fallback: `qwen3.6-plus → qwen3.5-flash-02-23`, `qwen3-8b → qwen3.5-flash-02-23`

### Проблема 2: CrewAI + Qwen35B = TypeError NoneType
**Суть**: `qwen3.5-35b-a3b` не поддерживает tool-calling формат CrewAI.
`response.choices[0]` возвращает None → `TypeError: 'NoneType' object is not subscriptable`

**Решение**: `/api/search` больше не использует CrewAI.
`tasks.search_metal()` — прямой вызов `call_llm()` без CrewAI агентов.

### Проблема 3: Цена ₽/т умножается на метры
**Суть**: AI получал цены за тонну, но умножал на количество метров →
60 метров × 92 000 ₽/т = 5 520 000 ₽ (должно быть ~36 240 ₽)

**Решение** в `_SEARCH_SYS` (tasks.py):
- Добавлена таблица весов (кг/м) для всех типов труб
- Добавлены цены ₽/метр = (кг/м × ₽/т) / 1000
- Жёсткое правило: `unit="метров" → price_per_unit = ₽/м`

### Проблема 4: Timeout на сайте (25с) < время ответа Railway (20-40с)
**Суть**: AI поиск занимает 20-40 секунд. Vercel прерывал запрос.
Срабатывал fallback (keyword-based), показывал только 1 товар вместо 3.

**Решение** в `app/api/ai/search/route.ts`:
- `AbortSignal.timeout(52000)` вместо 25000
- `export const maxDuration = 55` для Vercel Pro (лимит функции)

### Проблема 5: proxy.ts блокировал /api/* в CRM
**Суть**: Middleware CRM перенаправлял все запросы (включая API) на `/login`.
Трекинг и webhook молча падали.

**Решение**: `crm/src/proxy.ts` — `pathname.startsWith('/api/')` добавлен в `isPublic`.
Каждый API маршрут проверяет авторизацию сам.

---

## 12. ФАЙЛОВАЯ СИСТЕМА (ПОЛНАЯ)

### metallportal/ (публичный сайт)

```
app/
├── page.tsx                    ← Главная страница (SmartSearch, CategoryRow, Hero)
├── layout.tsx                  ← Root layout (шрифты, тема, Header, Footer, track.js)
├── globals.css                 ← CSS переменные темы (--gold, --background и т.д.)
├── sitemap.ts                  ← Динамический sitemap.xml
├── catalog/
│   ├── layout.tsx              ← Sidebar + CatalogFiltersProvider
│   ├── [category]/page.tsx     ← Уровень 1 (список подкатегорий)
│   └── [category]/[sub]/page.tsx ← Уровень 2 (товары CatalogView)
├── tools/
│   ├── layout.tsx              ← SEO + FAQPage JSON-LD
│   └── page.tsx                ← 5 калькуляторов (табы)
├── cart/page.tsx               ← Корзина
├── search/page.tsx             ← Поиск
├── admin/                      ← Админка (6 страниц)
└── api/
    ├── search/route.ts         ← GET, текстовый поиск товаров (ILIKE, edge)
    ├── ai/search/route.ts      ← POST, AI поиск → Railway (maxDuration=55)
    ├── orders/create/route.ts  ← POST, создание заказа → CRM
    ├── contact/route.ts        ← POST, форма обратной связи → CRM
    ├── generate-image/route.ts ← POST, генерация фото (fal.ai)
    ├── popular-products/       ← GET, топ-4 для главной
    └── cron/trigger-agents/    ← POST, Vercel Cron → Railway

components/
├── SmartSearch.tsx             ← AI поиск + корзина + форма (главная фича)
├── AISearch.tsx                ← Старый AI поиск (deprecated, заменён SmartSearch)
├── DocumentUpload.tsx          ← Загрузка сметы → КП
├── ThemeProvider.tsx
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Navigation.tsx
├── catalog/
│   ├── CatalogView.tsx         ← Список товаров (фильтры, пагинация)
│   ├── ProductTable.tsx        ← Таблица (desktop) + MobileProductRow
│   ├── ProductDetailView.tsx   ← Страница товара
│   ├── ProductCalculator.tsx   ← Калькулятор на странице товара (т/м)
│   ├── PriceBlock.tsx
│   └── CatalogSidebar.tsx
├── tools/
│   ├── WeightCalc.tsx
│   ├── FoundationCalc.tsx      ← Фундамент (лента/плита/столб)
│   ├── MeshCalc.tsx
│   ├── SheetCalc.tsx           ← Раскрой листа
│   ├── EstimateCalc.tsx        ← Смета
│   └── ToolSearchBox.tsx       ← Переиспользуемый поиск для калькуляторов
└── home/
    ├── Hero.tsx
    ├── CategoryRow.tsx
    └── CTASection.tsx

lib/
├── supabase.ts                 ← createClient (anon для сайта)
├── queries.ts                  ← getCategories, getProducts, getProductBySlug
├── database.types.ts           ← TypeScript типы Supabase
├── metalCalc.ts                ← weightPerMeter(), ARMATURA[], BALKA[], SHVELLER[]
├── settings.ts                 ← getSetting() из site_settings
├── ai-client.ts                ← searchMetal(), voiceSearch(), parseDocument()
└── fal.ts                      ← fal.ai клиент

contexts/
├── CartContext.tsx              ← localStorage корзина
└── CatalogFiltersContext.tsx

hooks/
├── useProductPrice.ts          ← ProductHit, calcTotalRub()
└── useContactAutoFill.ts

data/
└── catalog_full.json           ← 12 166 товаров (исходник импорта)

scripts/                        ← 19 скриптов (tsx)
├── import_remaining.ts         ← Импорт товаров
├── generate_cards.ts           ← SEO через OpenRouter
└── ...

supabase/
└── migrations/                 ← SQL миграции

vercel.json                     ← Cron schedule (9:00 МСК)
```

### crm/ (CRM приложение)

```
src/
├── app/
│   ├── (auth)/login/           ← Логин
│   ├── (auth)/join/            ← Активация аккаунта по инвайту
│   └── (dashboard)/
│       ├── layout.tsx          ← Sidebar + авторизация
│       ├── dashboard/          ← Дашборд (воронка, KPI, realtime)
│       ├── contacts/           ← Список + карточка контакта
│       ├── deals/              ← Kanban
│       ├── queue/              ← AI Queue
│       ├── costs/              ← CostsDashboard (ai_cost_log)
│       ├── bezos/              ← Бизнес-ассистент
│       ├── campaigns/          ← SMM (генерация + публикация)
│       ├── calls/              ← Звонки + Whisper анализ
│       ├── channels/           ← Каналы коммуникаций
│       ├── analytics/          ← Аналитика
│       └── settings/           ← Настройки (Resend, Telegram, команда)
│   └── api/
│       ├── auth/               ← login/logout
│       ├── webhook/            ← Приём заявок с сайта
│       ├── track/              ← Приём событий трекинга
│       ├── contacts/           ← CRUD контактов + activity
│       ├── deals/              ← CRUD сделок
│       ├── ai/queue/           ← AI Queue approve/reject/snooze
│       ├── bezos/              ← Вопросы CEO (→ harlan-ai)
│       ├── costs/              ← Данные расходов + reconcile
│       ├── social/             ← Генерация и публикация постов
│       ├── calls/              ← Анализ звонков
│       ├── telegram/           ← Bot setup/status + webhook
│       ├── email/              ← Resend
│       ├── settings/           ← Tenant settings
│       └── team/               ← Команда + инвайты
├── lib/
│   ├── supabase-server.ts      ← Supabase с service role
│   ├── ai.ts                   ← analyzeNewLead(), generateWeeklyInsight()
│   ├── telegram.ts             ← notifyManager()
│   ├── email.ts                ← Resend: sendEmail(), buildProposalEmail()
│   └── settings.ts             ← getSetting() из tenant_settings + env
├── components/
│   ├── layout/Sidebar.tsx      ← Навигация CRM
│   ├── ui/Drawer.tsx           ← Slide-in панель
│   ├── ui/StatCard.tsx
│   ├── dashboard/FunnelWithDrawers.tsx  ← Воронка продаж
│   └── dashboard/DashboardRealtime.tsx  ← Supabase Realtime
└── public/
    └── track.js                ← Скрипт трекинга для сайтов
```

### harlan-ai/ (AI микросервис)

```
src/harlan_ai/
├── config.py                   ← ГЛАВНЫЙ ФАЙЛ: модели, цены, fallback, call_llm()
├── tasks.py                    ← ВСЕ AI задачи: search_metal, score_lead, generate_kp...
├── main.py                     ← FastAPI: все /api/* эндпоинты
├── crews/
│   ├── bezos_crew.py           ← CEO агент (legacy, заменён tasks)
│   ├── sales_crew.py           ← Продажи (legacy)
│   ├── search_crew.py          ← run_voice_search() (CrewAI + Whisper)
│   ├── document_crew.py        ← parse_estimate() (PDF → JSON позиции)
│   └── content_crew.py         ← Контент (legacy)
└── tools/
    ├── supabase_tools.py       ← SearchProductsTool, SaveMemoryTool
    ├── telegram_tools.py       ← TelegramSendTool
    └── cost_logger.py          ← log_llm_call(), calculate_cost()
```

---

## 13. ЦЕНООБРАЗОВАНИЕ AI (апрель 2026)

| Задача | Модель | Цена/вызов | Частота |
|---|---|---|---|
| Утренний бриф | qwen3.6-plus | **$0.00** | 1/день |
| Стратегический вопрос (Bezos) | qwen3.6-plus | **$0.00** | по запросу |
| Пост для Telegram | qwen3.6-plus | **$0.00** | несколько/день |
| Поиск металла | qwen3-8b | ~$0.001 | при каждом поиске |
| Скоринг лида | qwen3.5-flash | ~$0.000005 | при каждом новом лиде |
| Генерация КП | qwen3.5-flash | ~$0.0004 | по запросу |
| Скрипт звонка | qwen3.5-flash | ~$0.0003 | по запросу |
| Классификация письма | qwen3.5-flash | ~$0.000005 | при каждом письме |

**Ориентировочный бюджет при 100 лидах/мес**: $0.5-2/мес (без учёта поиска)

---

## 14. ПРАВИЛА ДЛЯ АГЕНТОВ И РАЗРАБОТЧИКОВ

### Обязательно перед началом работы
1. Прочитать этот файл полностью
2. Проверить статус деплоя: `https://harlan-ai-production-production.up.railway.app/health`
3. Понять контекст задачи: сайт / CRM / AI микросервис

### Правила изменений
1. **НИКОГДА** не менять модели напрямую в tasks.py — только через Railway Variables
2. **НИКОГДА** не хардкодить API ключи в коде
3. **НИКОГДА** не менять визуальный дизайн без явного запроса
4. **TypeScript**: перед деплоем `npx tsc --noEmit`
5. **После задачи**: обновить этот файл (раздел "Статус") и `PROJECT_STATUS.md`

### Деплой
```bash
# Сайт
git push origin main  # → Vercel автодеплой

# CRM
cd crm && npx vercel --prod --yes

# AI микросервис
cd harlan-ai && git push && railway up --detach
```

### Дебаггинг AI
```bash
# Проверить что Railway жив
curl https://harlan-ai-production-production.up.railway.app/health

# Тест поиска
curl -X POST https://harlan-ai-production-production.up.railway.app/api/search \
  -H "X-API-Key: harlan_steel_ai_2024_secret_key_xK9mP3nQ" \
  -H "Content-Type: application/json" \
  -d '{"query":"труба 40х40 5 тонн"}'

# Тест утреннего брифа
curl -X POST https://harlan-ai-production-production.up.railway.app/api/agents/bezos/morning \
  -H "X-API-Key: harlan_steel_ai_2024_secret_key_xK9mP3nQ"

# Логи Railway
railway logs --tail 50

# Сверка расходов
curl https://harlan-ai-production-production.up.railway.app/api/costs/openrouter \
  -H "X-API-Key: harlan_steel_ai_2024_secret_key_xK9mP3nQ"
```

---

## 15. СТРАТЕГИЯ И КУДА ИДЁМ

### Краткосрочно (1-3 месяца)
- Ускорить AI поиск (кэш, меньшая модель или streaming)
- Добавить личный кабинет покупателя
- SEO тексты для всех 12 166 товаров
- Интегрировать телефонию (Voximplant + Whisper)

### Среднесрочно (3-12 месяцев)
- WhatsApp WABA (360Dialog)
- SMS рассылки
- n8n как оркестратор (отказ от Vercel Cron)
- Кабинет поставщика (загрузка прайсов, управление остатками)
- Второй поставщик (мульти-поставщик)
- Голосовой AI менеджер (ElevenLabs + Voximplant)

### Долгосрочно (SaaS)
- Мультитенантность уже заложена в схеме (tenant_id везде)
- CRM как SaaS для металлоторговых компаний: 30 000–80 000 руб/мес
- Маржа 60-75% (AI дешевле людей)
- Оценочный TAM: ~500 металлоторговых компаний в РФ

### Архитектурные принципы
1. **ИИ делает → человек подтверждает** (AI Queue)
2. **Прозрачность стоимости** (ai_cost_log для каждого вызова)
3. **PII изоляция** (данные клиентов только в платных моделях)
4. **Одна функция = один вызов** (никаких агентов без нужды)
5. **Fallback на всех уровнях** (модели, API, поиск)

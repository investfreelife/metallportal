# PROJECT_STATUS.md — МеталлПортал
*Последнее обновление: 25 апреля 2026*

## ✅ СДЕЛАНО

### SmartSearch — Умный поиск → Корзина → CRM (25 апр 2026)
- **`components/SmartSearch.tsx`** — новый компонент: 4 шага (поиск → корзина → форма → успех). Поддержка голосового поиска, редактирование количества +/-, добавление позиций в корзину, форма контактов, отправка в CRM
- **`app/api/orders/create/route.ts`** — новый API: создаёт контакт в CRM (или находит существующий), создаёт сделку в `deals`, создаёт задачу в `ai_queue`, отправляет Telegram уведомление менеджеру, запускает AI продавца через harlan-ai в фоне
- **`app/page.tsx`** — заменён `AISearch` на `SmartSearch`
- **`harlan-ai/search_crew.py`** — обновлён `recommend_task`: возвращает структурированный JSON с полями `items[]`, `total_price`, `recommendation`, `clarifying_question`, `missing_info`; включены эталонные цены РФ 2024
- Env vars необходимы: `NEXT_PUBLIC_AI_URL`, `NEXT_PUBLIC_AI_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MANAGER_CHAT_ID`, `AI_API_KEY`
- Инфраструктура: GitHub + Vercel + Supabase
- 12,166 товаров импортированы, все в правильных категориях
- Цены: 12,166 price_items заполнены
- Каталог: 3 уровня, счётчики через RPC (исправлен баг лимита 1000)
- Админка: 6 страниц
- Тёмная/светлая тема
- RPC функция get_product_counts() в Supabase

### SEO (25 апр 2026)
- **`public/robots.txt`** — Allow /, Disallow /api/ /_next/ /*?, Sitemap: https://metallportal.vercel.app/sitemap.xml
- **`app/sitemap.ts`** — динамический sitemap: статические страницы + все активные категории (1/2/3 уровень) + все активные товары. URL: `/sitemap.xml`
- **`app/layout.tsx`** — добавлены `metadataBase`, `title.template`, `openGraph` defaults, `twitter: { card: "summary_large_image" }`, `robots`
- **`app/page.tsx`** — уникальный `metadata` (title/description/canonical/OG) + Organization JSON-LD (`@type: Organization`)
- **`app/catalog/[category]/page.tsx`** — добавлен `generateMetadata` с title/description/canonical/OG для каждой категории
- **`app/catalog/[category]/[subcategory]/page.tsx`** — расширен `generateMetadata` (description, canonical, OG для категорий и товаров) + Product JSON-LD (`@type: Product`) с offers/price/priceCurrency/availability при показе товара
- **`app/tools/layout.tsx`** — новый файл: metadata (title/description/canonical/OG) + FAQPage JSON-LD (4 вопроса о калькуляторах)

### UI/UX — Калькуляторы металлопроката (19 апр 2026)
- **ToolSearchBox** (`components/tools/ToolSearchBox.tsx`): создан переиспользуемый компонент поиска товаров с дебаунсом (280мс), выпадающим списком, автозапуском поиска при изменении `initialQuery`
- **Все калькуляторы** переведены на пошаговый (Step 1-4) интерфейс с `ToolSearchBox`:
  - `WeightCalc` — вес металла (любой прокат: кг/м, кг, тонны)
  - `FoundationCalc` — арматура фундамента (ленточный/плита/столбчатый)
  - `MeshCalc` — арматурная сетка
  - `SheetCalc` — раскрой листа
- **Результаты расчёта** — укрупнены: итого тонн `text-4xl font-black text-gold`, к оплате `text-3xl font-black text-emerald-500`
- **Кнопка В корзину** — уменьшена: `py-2 text-sm font-semibold` (вместо `py-3 font-bold`)
- **Step** компонент (`components/tools/Step.tsx`): нумерованные шаги с подсказками
- **`/api/search`** — добавлено поле `weight_per_meter` в ответ для ToolSearchBox

### Mobile App — Sprint 1-3 (20 апр 2026)
- **Стек**: Expo 54, Expo Router, Supabase, Zustand (без NativeWind)
- **Auth**: Login, Register, session listener в `_layout.tsx`, редирект по сессии
- **Каталог**: 2-уровневый drill-down (категория → подкатегория → товары), поиск категорий
- **Карточка товара**: фото, цена, характеристики, выбор кол-ва, кнопка "В корзину"
- **Корзина**: список товаров, управление qty, итог, форма оформления (имя/телефон/email), POST на `/api/orders`
- **Заказы**: экран истории заказов (localStore), статусы с цветами
- **Табы**: Каталог / Корзина / Заказы / Профиль
- **Файлы**: `mobile/app/(auth)/`, `mobile/app/(tabs)/`, `mobile/app/catalog/`, `mobile/stores/`

### Фильтры навесов (20 апр 2026)
- `CatalogView.tsx`: для страниц `/catalog/navesy*` показываются специальные фильтры вместо диаметра/толщины:
  - **Форма кровли** — Односкатный, Двускатный, Арочный, Полуарочный, Четырёхскатный (извлекается из названия товара)
  - **Материал кровли** — Поликарбонат, Профнастил, Металлочерепица (извлекается из названия)
  - **Усиление** — Усиленный, Сверхусиленный (извлекается из названия, появляется только если такие товары есть)
  - **Назначение** — Для автомобиля, Для парковки, Беседка, Для дачи, С хозблоком (по slug категории)
- Фильтры "Диаметр" и "Толщина" скрыты на страницах навесов
- Логика: `isNavesy = categorySlug.startsWith("navesy")`

### Адаптивность (19 апр 2026)
- **`/tools` страница**: табы переведены с `overflow-x-auto` на `flex-wrap` — все 6 табов видны без скролла
- **`/cart` страница**: карточки товаров переделаны на 2-строчный layout для мобильных (изображение+название / кол-во+цена+удалить)

### AI CRM — Phase 1 (20 апр 2026)
- **`crm/`** — отдельное Next.js 16 + React 19 + Tailwind v4 приложение в корне репо
- **Стек**: Next.js 16, @supabase/ssr 0.10, Zustand, TanStack Query, Lucide, date-fns
- **Авторизация**: через таблицу `admin_users` (та же что на сайте) + HTTP-only cookie `crm_session`
  - API: `POST /api/auth/login` → проверяет `admin_users` → ставит cookie
  - `proxy.ts`: Edge Runtime, `request.cookies.get('crm_session')` — проверка наличия cookie
  - `getSession()` в dashboard layout: полная валидация (exp, base64 decode через Buffer в Node.js)
- **Страницы**: Login, Dashboard `/dashboard`, Contacts, Contact Detail, Deals (Kanban), Deal Detail, AI Queue, Settings
- **Компоненты**: `Sidebar.tsx` (тёмный #0f172a, активный #1a56db), метрики, таблица контактов, канбан сделок
- **AI Queue**: карточки с одобрением/отклонением/редактированием/откладыванием (snooze 1ч/3ч/1день)
- **БД**: схема в `crm/supabase-schema.sql` (выполнена в Supabase); таблица `admin_users` уже существует
- **Деплой**: https://metallportal-crm2.vercel.app (логин: admin, пароль как на сайте)
- **Архитектура**: `crm/ARCHITECTURE.md` — полная спецификация SaaS платформы (Phase 1-7)
- **Dev**: `cd crm && npm run dev -- --port 3002`

### AI CRM — Phase 2: Трекинг и шина (20 апр 2026)
- **`crm/public/track.js`** — JS трекер для сайтов (page_view, page_leave+scroll, phone_click, file_download, mpTrack API)
  - Подключить: `<script src="https://metallportal-crm2.vercel.app/track.js?tid=TENANT_ID" defer>`
  - МеталлПортал: уже подключён в `app/layout.tsx` с tid=a1000000-0000-0000-0000-000000000001
- **`crm/src/app/api/track/route.ts`** — приёмник событий (CORS, scoring, создание контактов, ai_queue)
- **`crm/src/app/api/webhook/route.ts`** — webhook от форм сайта (order/callback/quote)
  - При заказе: создаёт контакт + активность + задачу в AI Queue с priority=high
- **`app/api/orders/route.ts`** — интегрирован с CRM webhook (fire-and-forget после создания заказа)
- **Scoring**: form_submit+30, add_to_cart+25, phone_click+15, page_view+2
- **SUPABASE_SERVICE_ROLE_KEY** добавлен в Vercel env для обхода RLS

### AI CRM — Phase 3: ИИ-мозг и Telegram (20 апр 2026)
- **`crm/src/lib/ai.ts`** — GPT-4o (via OpenRouter) анализ новых лидов
  - `analyzeNewLead()` → reasoning, suggested_message, action_type, priority, segment
  - `generateWeeklyInsight()` → еженедельный аналитический отчёт
- **`crm/src/lib/telegram.ts`** — уведомления менеджеру с кнопками
  - `notifyManager()` → отправляет карточку с кнопками ✅ ✏️ ❌ ⏰
  - Нужны env: `TELEGRAM_BOT_TOKEN`, `CRM_MANAGER_TG_ID` (chat_id менеджера)
- **`crm/src/app/api/ai/queue/[id]/[action]/route.ts`** — PATCH approve/reject/snooze1/3/24
- **`crm/src/app/api/webhook/route.ts`** — обновлён: вызывает GPT-4o → обновляет ai_queue → уведомляет Telegram
- **`app/api/telegram/webhook/route.ts`** — добавлен обработчик `callback_query` с префиксом `crm_`
  - При нажатии кнопки → PATCH на CRM API → answerCallbackQuery → editMessageReplyMarkup
- **⚠️ Нужно настроить**:
  1. `TELEGRAM_BOT_TOKEN` → добавить в Vercel env CRM проекта
  2. `CRM_MANAGER_TG_ID` → написать @userinfobot в Telegram → получить chat_id → добавить в Vercel env
  3. После добавления env → `npx vercel --prod` из `crm/`

### AI CRM — Phase 2: Power Dashboard + Content Machine + Telephony (24 апр 2026)
**Деплой**: https://metallportal-crm2.vercel.app — коммит `4cbb95c`

**Модуль 1: Power Dashboard**
- `crm/src/components/ui/Drawer.tsx` — slide-in панель (ESC, backdrop click, анимация)
- `crm/src/components/ui/StatCard.tsx` — метрика с дельтой (up/down/neutral)
- `crm/src/components/ui/RankBar.tsx` — горизонтальная шкала с цветом и суффиксом
- `crm/src/components/dashboard/FunnelWithDrawers.tsx` — кликабельная воронка: каждый шаг открывает Drawer с глубокой аналитикой (источники, конверсии, возражения, причины проигрышей, ИИ-рекомендации)
- `crm/src/components/dashboard/TrafficChannels.tsx` — блок 8 каналов трафика, клик → Drawer с Chart.js (lazy import), таблица ROI/конверсия/цена лида, drill-down по каналу
- `crm/src/components/dashboard/DashboardRealtime.tsx` — Supabase Realtime: автообновление дашборда при новых задачах ИИ
- `crm/src/app/(dashboard)/dashboard/page.tsx` — обновлён: +3 новых запроса (sourceMap, lostReasons, wonAmount, hotDelta), воронка заменена на FunnelWithDrawers, добавлен блок TrafficChannels, метрика "Горячих лидов" показывает дельту за неделю
- **npm**: добавлены `chart.js`, `react-chartjs-2`, `openai`

**Модуль 2: Контент-машина**
- `crm/src/app/api/social/generate/route.ts` — POST: генерирует пост через OpenRouter GPT-4o-mini (5 типов: price_update, product_focus, case_study, gost_tip, market_review), сохраняет как draft в `social_posts`
- `crm/src/app/api/social/publish/route.ts` — POST: публикует в Telegram через Bot API, обновляет статус, создаёт activity
- `crm/src/app/(dashboard)/campaigns/page.tsx` + `CampaignsClient.tsx` — UI: генератор постов, предпросмотр, история, кнопка публикации

**Модуль 3: Телефония**
- `crm/src/app/api/calls/analyze/route.ts` — POST: Whisper транскрипция + GPT-4o анализ (summary, sentiment, quality_score, next_step, action_required → ai_queue)
- `crm/src/app/(dashboard)/calls/page.tsx` + `CallsClient.tsx` — UI: метрики, список звонков, детали, кнопка анализа

**Модуль 4: Заглушки**
- `crm/src/app/(dashboard)/telegram/page.tsx` — страница Telegram (Phase 2 placeholder)
- `crm/src/app/(dashboard)/reports/page.tsx` — страница Отчёты (Phase 2 placeholder)

**SQL (выполнить в Supabase SQL Editor):**
- `crm/supabase/migrations/20260424_phase2_social_calls.sql` — таблицы `social_posts` + `calls` с RLS

**⚠️ Env vars нужны (Vercel + .env.local):**
- `TELEGRAM_BOT_TOKEN` — для публикации постов
- `TELEGRAM_CHANNEL_ID` — @канал или -100...
- `OPENAI_API_KEY` — для Whisper транскрипции

### AI CRM — Дашборд мирового уровня (23 апр 2026)
- **`crm/src/components/layout/Sidebar.tsx`** — переработан: ширина 200px, секции (Главное/Продажи/Коммуникации/Аналитика), новые пункты (Звонки, Telegram, Рассылки, Отчёты), бейджи для `pendingCount`/`unreadEmails`/`missedCalls`
- **`crm/src/app/(dashboard)/layout.tsx`** — живые данные для Sidebar: `pendingCount` из `ai_queue`, `unreadEmails` из `emails`
- **`crm/src/app/(dashboard)/dashboard/page.tsx`** — исправлен баг (`settings`→`tenant_settings`), добавлена Воронка продаж в правую колонку (реальные данные из deals по стадиям)

### AI CRM — Phase 4: Каналы и аналитика (20 апр 2026)
- **`crm/src/lib/email.ts`** — Resend email (`sendEmail`, `buildProposalEmail`, `buildOrderConfirmEmail`)
- **`crm/src/app/api/email/send/route.ts`** — POST /api/email/send (template: 'proposal'|'order_confirm')
- **`crm/src/app/(dashboard)/analytics/page.tsx`** — Аналитика: KPI, источники, воронка, топ страницы, AI Score
- **`crm/src/app/(dashboard)/settings/page.tsx`** — Переписан: статус всех интеграций, инструкции, трекинг-код, webhook URL
- **Sidebar** — добавлена вкладка Аналитика (BarChart2)
- **`crm/supabase-migration-001.sql`** — ⚠️ НУЖНО выполнить в Supabase SQL Editor
- **Env vars нужны**: `TELEGRAM_BOT_TOKEN`, `CRM_MANAGER_TG_ID`, `RESEND_API_KEY`

### Phase 9: Критические исправления — формы и аналитика (20 апр 2026)
**Корневая причина:** `proxy.ts` (middleware CRM) блокировал ВСЕ запросы включая `/api/*`, делая редирект 307 → `/login`. Формы и трекинг молча падали.

**Исправления:**
- `crm/src/proxy.ts` — добавлен `pathname.startsWith('/api/')` в `isPublic` → теперь все API маршруты доступны без авторизации (auth внутри каждого маршрута)
- `app/api/contact/route.ts` — убран fire-and-forget, добавлено ожидание ответа CRM + логирование ошибок + CORS headers + валидация
- `crm/supabase-fix-all.sql` — единый файл исправления БД (tenant_settings + колонки + RLS)

**Тест после исправления:**
```
POST /api/webhook → {"ok":true,"contact_id":"3debd8f0...","is_new":true} ✅
POST /api/track   → {"ok":true} ✅
```

**ВАЖНО — выполнить в Supabase SQL Editor:**
Файл `crm/supabase-fix-all.sql` — создаёт tenant_settings, фиксирует CHECK constraints, RLS policies

### Phase 8: Telegram Bot — полная интеграция (20 апр 2026)
**Единый webhook бота в CRM** — `crm/src/app/api/telegram/bot/route.ts`
- CRM кнопки: `crm_approve/reject/snooze` → PATCH `/api/ai/queue/:id/:action`
- `/start invite_TOKEN` — активация аккаунта менеджера + сохранение telegram_chat_id
- `/start` — приветствие клиента + создание контакта в CRM
- `/status`, `/queue` (только менеджер) — статистика и список задач
- Входящие сообщения → создание контакта + activity + ai_queue + уведомление менеджера

**Setup API** — `crm/src/app/api/telegram/setup/route.ts`
- `POST /api/telegram/setup` — регистрирует webhook + тест-сообщение менеджеру
- `DELETE /api/telegram/setup` — отключает webhook

**Status API** — `crm/src/app/api/telegram/status/route.ts`
- `GET /api/telegram/status` — статус бота (имя, username, webhook, ошибки)

**Settings UI** — новая вкладка 📱 Telegram в SettingsClient:
- Статус подключения (🟢/🔴) с именем бота
- Инструкция по настройке (3 шага)
- Кнопка **Подключить** → регистрирует webhook + тест → показывает результат
- Ссылка на бота для клиентов (копировать)

**Как подключить (1 шаг):**
1. CRM → Настройки → 📱 Telegram → кнопка **"Подключить мой Telegram"**
2. Открыть ссылку → написать боту → Chat ID сохраняется автоматически ✅

**Что скрыто от пользователей (только в env):**
- `OPENROUTER_API_KEY` — не показывается в UI никогда
- `TELEGRAM_BOT_TOKEN` — не показывается в UI никогда
- Вкладка 🔑 "Ключи" — только Email (Resend) + Webhook Secret

**`/api/telegram/link`** — генерирует deep-link `t.me/BOT?start=manager_TOKEN` (живёт 10 мин), после click → бот сохраняет chat_id в DB

### Phase 7: Трекинг и формы — ИСПРАВЛЕНИЯ (20 апр 2026)
**Корневые причины:**
1. `track.js` с `defer` — `document.currentScript` = null → ENDPOINT падал на `/api/track` главного сайта (не существует)
2. `sendBeacon` без Blob → content-type text/plain вместо application/json
3. `/api/contact` не существовал → CategoryCallbackCTA + NavesOrderModal молча падали
4. CTASection — кнопка Send не была подключена к API
5. AI/Telegram ключи читались из env, не из DB

**Исправления:**
- `crm/public/track.js` — хардкод `CRM_ORIGIN = 'https://metallportal-crm2.vercel.app'`, querySelector для tid, sendBeacon с Blob
- `app/api/contact/route.ts` — новый endpoint, пересылает в CRM webhook
- `components/home/CTASection.tsx` — добавлена форма с phone + submit → /api/contact + mpTrack
- `components/catalog/CategoryCallbackCTA.tsx` — добавлен mpTrack("form_submit")
- `components/catalog/NavesOrderModal.tsx` — добавлен mpTrack("form_submit")
- `app/cart/page.tsx` — добавлен mpTrack("form_submit") при оформлении заказа
- `crm/src/lib/ai.ts` — OPENROUTER_KEY читается через getSetting (env → DB)
- `crm/src/lib/telegram.ts` — BOT_TOKEN/MANAGER_TG_ID читаются через getSetting (env → DB)
- `crm/src/app/api/track/route.ts` — ai_queue insert обёрнут в try/catch

### AI CRM — Phase 6: Settings 2.0 (20 апр 2026)
- **`crm/supabase-migration-002.sql`** — ⚠️ ВЫПОЛНИТЬ: таблица `tenant_settings`, колонки invite в `admin_users`
- **`crm/src/lib/settings.ts`** — `getSetting(key)` читает из env → DB; `setSetting(key, val)` пишет в DB
- **`crm/src/app/api/settings/route.ts`** — GET/POST настроек из UI (API ключи, токены)
- **`crm/src/app/api/team/route.ts`** — GET список, POST создать, PATCH роль/статус
- **`crm/src/app/api/team/invite/route.ts`** — создание инвайта + авто-отправка через Telegram если есть chat_id
- **`crm/src/app/api/team/join/route.ts`** — GET/POST активация по токену
- **`crm/src/app/(auth)/join/page.tsx`** — страница активации аккаунта по ссылке
- **`crm/src/app/(dashboard)/settings/SettingsClient.tsx`** — полный tabbed UI:
  - Вкладка "Интеграции": вставить API ключи прямо в CRM → сохраняется в БД
  - Вкладка "Команда": список менеджеров + кнопки роли/вкл/выкл + инвайт
  - Вкладка "Сайт": tracking script, webhook URL, примеры
- **Invite flow**: создать сотрудника → ссылка `/join?token=XXX` → сотрудник устанавливает пароль → статус active
- **Telegram auto-invite**: если указан `telegram_chat_id` → бот сам отправляет логин+пароль+ссылку

### AI CRM — Phase 5: Автоматизация (20 апр 2026)
- **`crm/src/app/(dashboard)/contacts/[id]/AddActivityForm.tsx`** — форма добавления заметки/звонка/письма к контакту
- **`crm/src/app/api/contacts/[id]/activity/route.ts`** — POST /api/contacts/:id/activity
- **`crm/src/app/api/contacts/route.ts`** — POST /api/contacts (создание контакта вручную)
- **ContactsClient** — модальная форма "Новый контакт" с редиректом на карточку
- **QueueClient** — approve → если action=send_proposal+email контакта → auto-send email; reject/snooze → REST API
- **Фикс**: activities.title→subject, activities.notes→body (align со schema)

### Harlan Steel AI Platform — Phase 1 (25 апр 2026)
- **`/Users/sergey/Desktop/металл/harlan-ai/`** — новый Python микросервис (отдельный репозиторий)
- **Стек**: Python 3.12 + CrewAI 1.12 + FastAPI + OpenRouter + Supabase
- **Структура**: `src/harlan_ai/` — config, main, crews/, tools/, flows/
- **Crews**: `bezos_crew` (CEO утренний/еженедельный), `sales_crew` (скоринг лидов + дневной цикл), `search_crew` (AI поиск + Whisper), `document_crew` (расшифровка смет → КП), `content_crew` (Telegram посты + SEO)
- **Tools**: `supabase_tools` (CRM stats, hot leads, memory, queue, products), `telegram_tools` (send), `search_tools` (web search, competitor prices)
- **Flows**: `MorningFlow` (Безос → Продавец → Контент), `LeadFlow` (score + KP + task)
- **FastAPI**: `/api/search`, `/api/search/voice`, `/api/documents/parse`, `/api/agents/bezos/*`, `/api/agents/sales/*`, `/api/cron/morning`
- **Dockerfile**: python:3.12-slim + tesseract-ocr-rus + UV
- **Next.js интеграция**:
  - `lib/ai-client.ts` — searchMetal, voiceSearch, parseDocument, processLead
  - `components/AISearch.tsx` — поиск + голосовой ввод
  - `components/DocumentUpload.tsx` — drag&drop сметы → КП
  - `app/api/cron/trigger-agents/route.ts` — Vercel cron → Python
  - `vercel.json` — cron schedule 9:00 МСК
- **⚠️ Следующие шаги**:
  1. `cp .env.example .env` → заполнить все ключи
  2. `uv venv && uv pip install -e .` → локальный тест
  3. `uvicorn src.harlan_ai.main:app --reload`
  4. Создать репо `harlan-ai` на GitHub → Railway деплой
  5. Добавить `NEXT_PUBLIC_AI_URL` + `AI_API_KEY` + `CRON_SECRET` в Vercel

## 🔄 В ПРОЦЕССЕ
- SEO генерация: ~3900/12166 готово, скрипт крутится в фоне
  Логи: tail -f /tmp/seo_generation.log
- Windsurf: выполняет задание (уточнить статус)

## 📋 СЛЕДУЮЩИЕ ЗАДАЧИ (по приоритету)
1. Личный кабинет покупателя (app/account/profile, orders, favorites)
2. SEO seo_text для всех товаров (после title+description)
3. Фото товаров через fal.ai (добавить FAL_API_KEY в .env.local)
4. Кабинет поставщика (app/supplier/)
5. Telegram CRM бот
6. Заполнить пустые категории (конструкции, заборы, здания)

## 🏗 АГЕНТЫ
- Claude Code → скрипты, БД, баги. Читает: START_HERE.md
- GPT-4o-mini → SEO карточки. Читает: SEO_RULES.md  
- Windsurf → UI/фронтенд. Читает: ARCHITECTURE.md
- n8n → оркестратор (планируется)

## 📁 КЛЮЧЕВЫЕ ФАЙЛЫ
- data/catalog_full.json — 12,166 товаров (исходник)
- scripts/generate_cards.ts — SEO через OpenRouter
- lib/queries.ts — запросы Supabase + RPC
- supabase/schema.sql — схема БД
- docs/CATALOG_STRUCTURE.md — структура категорий
- docs/SEO_RULES.md — правила SEO

## 🔑 ДОСТУПЫ (ключи в .env.local)
- Supabase: tmzqirzyvmnkzfmotlcj
- Vercel: metallportal
- GitHub: investfreelife/metallportal
- OpenRouter: OPENROUTER_API_KEY ✓
- fal.ai: FAL_API_KEY (нужно добавить)

## ПРАВИЛО ДЛЯ АГЕНТОВ
После каждой задачи → обновить этот файл + git commit docs/PROJECT_STATUS.md

## SEO Progress
SEO (title+desc): 11095 из 12166 готово, последнее обновление: 2026-04-17 10:52

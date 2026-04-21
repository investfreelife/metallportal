# PROJECT_STATUS.md — МеталлПортал
*Последнее обновление: 19 апреля 2026*

## ✅ СДЕЛАНО
- Инфраструктура: GitHub + Vercel + Supabase
- 12,166 товаров импортированы, все в правильных категориях
- Цены: 12,166 price_items заполнены
- Каталог: 3 уровня, счётчики через RPC (исправлен баг лимита 1000)
- Админка: 6 страниц
- Тёмная/светлая тема
- RPC функция get_product_counts() в Supabase

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

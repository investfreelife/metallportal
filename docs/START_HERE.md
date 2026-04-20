# 🚀 СТАРТ — МеталлПортал
*Обновлено: 19 апреля 2026*

## Читай это первым. Всё что нужно для старта.

## Что это за проект
Маркетплейс металлопроката и металлоконструкций.
Цель: стать Amazon в металле для России.
URL: https://metallportal.vercel.app
Repo: https://github.com/investfreelife/metallportal

## Стек
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Storage + Auth)
- Vercel (автодеплой из GitHub main)
- Windsurf / Claude Code (пишут код)
- OpenRouter (gpt-4o-mini для SEO карточек)
- fal.ai (генерация фото, ключ нужно добавить)

## Текущий статус ✅
- [x] Инфраструктура: GitHub + Vercel + Supabase
- [x] Каталог: 3 уровня, sidebar, фильтры, сортировка
- [x] 12 166 товаров импортированы + цены заполнены
- [x] Счётчики товаров через RPC (исправлен баг лимита 1000)
- [x] Карточки товаров: табы, характеристики, SEO
- [x] Калькуляторы: вес / фундамент / сетка / лист / смета
- [x] ToolSearchBox: поиск товаров из каталога в калькуляторах
- [x] Корзина + форма заказа (localStorage)
- [x] Адаптивность: мобильная версия всех страниц
- [x] Тёмная/светлая тема
- [x] Админка: товары, категории, настройки, фото, меню
- [x] SEO title+description: 11 095 из 12 166 готово
- [ ] SEO seo_text (длинные описания) — не запущено
- [ ] Фото товаров через fal.ai — нужен FAL_KEY в .env.local
- [ ] Личный кабинет покупателя (app/account/ — заготовка)
- [ ] Кабинет поставщика (app/supplier/ — заготовка)
- [ ] Telegram CRM бот

## Следующие приоритеты
1. Личный кабинет покупателя (заказы, избранное, профиль)
2. SEO seo_text через GPT-4o-mini: `npx tsx scripts/generate_cards.ts`
3. Фото товаров через fal.ai (добавить FAL_KEY в .env.local)
4. Кабинет поставщика
5. Telegram CRM бот

## Поставщик 1
Название: Металл Комплект (mc.ru)
ID: a2000000-0000-0000-0000-000000000001
Позиций: 12 166

## Ключевые файлы
app/page.tsx              — Главная страница
app/tools/page.tsx        — Калькуляторы (5 штук)
app/cart/page.tsx         — Корзина
app/catalog/              — Каталог (3 уровня)
app/admin/                — Админка
app/api/search/route.ts   — Поиск товаров (edge)
components/tools/         — Все калькуляторы + ToolSearchBox
components/catalog/       — Каталог, карточки, фильтры
contexts/CartContext.tsx  — Глобальная корзина (localStorage)
hooks/useProductPrice.ts  — ProductHit интерфейс + calcTotalRub()
lib/queries.ts            — Все запросы к Supabase
lib/metalCalc.ts          — Формулы расчёта веса (ГОСТ)
supabase/schema.sql       — Схема БД
scripts/generate_cards.ts — SEO генерация
data/catalog_full.json    — 12 166 товаров (исходник)

## Как задеплоить
git add -A && git commit -m "описание" && git push origin main
# Vercel деплоит автоматически, ~2-4 мин
# Проверка TypeScript: npx tsc --noEmit

## Доступы (.env.local)
Supabase: tmzqirzyvmnkzfmotlcj
Vercel: metallportal
GitHub: investfreelife/metallportal
OPENROUTER_API_KEY — есть в .env.local
FAL_KEY — нужно добавить

## Детальная документация
docs/ARCHITECTURE.md      — полная архитектура, все компоненты, API, БД
docs/PROJECT_STATUS.md    — текущий прогресс и история изменений
docs/CATALOG_STRUCTURE.md — структура категорий каталога
docs/SEO_RULES.md         — правила SEO карточек товаров
docs/AGENTS.md            — описание агентов системы

## Правила для агентов
1. Прочитай docs/PROJECT_STATUS.md перед началом
2. После каждого изменения обнови docs/PROJECT_STATUS.md
3. Никогда не меняй изображения, тексты, дизайн без явного запроса
4. Проверяй TypeScript: npx tsc --noEmit
5. Коммить и пушить после каждой задачи

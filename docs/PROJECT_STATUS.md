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

### Адаптивность (19 апр 2026)
- **`/tools` страница**: табы переведены с `overflow-x-auto` на `flex-wrap` — все 6 табов видны без скролла
- **`/cart` страница**: карточки товаров переделаны на 2-строчный layout для мобильных (изображение+название / кол-во+цена+удалить)

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

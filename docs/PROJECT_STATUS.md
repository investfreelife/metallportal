# PROJECT_STATUS.md — МеталлПортал
*Последнее обновление: 17 апреля 2026*

## ✅ СДЕЛАНО
- Инфраструктура: GitHub + Vercel + Supabase
- 12,166 товаров импортированы, все в правильных категориях
- Цены: 12,166 price_items заполнены
- Каталог: 3 уровня, счётчики через RPC (исправлен баг лимита 1000)
- Админка: 6 страниц
- Тёмная/светлая тема
- RPC функция get_product_counts() в Supabase

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

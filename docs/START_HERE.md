# 🚀 СТАРТ — МеталлПортал

## Читай это первым. Всё что нужно для старта.

## Что это за проект
Маркетплейс металлопроката и металлоконструкций.
Цель: стать Amazon в металле для России.
URL: metallportal.vercel.app
Repo: github.com/investfreelife/metallportal

## Стек
- Next.js 14 + TypeScript + Tailwind
- Supabase (PostgreSQL + Storage + Auth)
- Vercel (автодеплой из GitHub main)
- Windsurf (пишет код)
- Claude Code (работает с БД и файлами)
- OpenRouter (GPT-4o-mini для карточек товаров)
- fal.ai (генерация фото)

## Текущий статус (обновляй после каждого шага)
- [x] Инфраструктура: GitHub + Vercel + Supabase
- [x] Каталог: 3 уровня, sidebar как cstg.ru
- [x] Карточки товаров: табы, калькулятор, SEO
- [x] Админка: 6 страниц
- [x] Тёмная/светлая тема
- [x] Документация в docs/
- [x] Импорт 12166 товаров ✅ (12166 products + 12166 price_items)
- [x] Категории проверены ✅ (все 12166 товаров в правильных leaf-категориях)
- [x] Счётчики товаров в каталоге ✅ (server-side GROUP BY через RPC, рекурсивные суммы)
- [ ] SEO карточки через GPT-4o-mini (скрипт готов, ожидает стабильной сети)
- [ ] Фото через fal.ai
- [ ] Личный кабинет покупателя
- [ ] Кабинет поставщика
- [ ] Telegram CRM бот

## Следующая задача прямо сейчас
Запустить SEO генерацию: npx tsx scripts/generate_cards.ts
(~12166 карточек, ~$12, ~20 часов на gpt-4o-mini)

## Поставщик 1
Название: Металл Комплект (mc.ru)
ID: a2000000-0000-0000-0000-000000000001
Файлы: /tmp/truby.csv, sortovojprokat.csv...
Всего позиций: 12166

## Категории (кратко)
metalloprokat → truby-vgp, truby-besshovnye,
  armatura-a500, list-gk, prof-okrash...
konstruktsii → angary, karkasy, navesy
zabory → zab-prof, vorota-kalitki
zdaniya → sklady-ceha, paviljony
zakaz → lazernaya, gibka, svarka

Полная структура: docs/CATALOG_STRUCTURE.md

## Ключевые файлы проекта
app/catalog/ — каталог (3 уровня)
app/admin/ — админка
components/catalog/ — компоненты каталога
lib/queries.ts — запросы к Supabase
scripts/generate_cards.ts — генерация SEO
scripts/import_remaining.ts — импорт товаров
data/catalog_full.json — 12166 товаров (JSON)
supabase/schema.sql — схема БД

## База данных (таблицы)
products — товары (name, slug, article, 
  description, gost, steel_grade, unit,
  seo_title, seo_description, seo_text)
categories — категории (3 уровня)
suppliers — поставщики
price_items — цены (base_price, discount_price,
  in_stock, stock_quantity)
site_settings — настройки сайта

## Правила работы
1. После каждого шага → обновить этот файл
2. git commit docs/ после обновления
3. Рутину делать через GPT-4o-mini (дёшево)
4. Сложные задачи → Claude Sonnet
5. Не держать весь контекст — читать только нужные файлы

## Детальная документация
docs/CATALOG_STRUCTURE.md — все категории
docs/SEO_RULES.md — правила SEO карточек
docs/AGENTS.md — описание агентов
docs/RULES.md — правила работы

## Как задеплоить
git add -A && git commit -m "описание" && git push
Vercel деплоит автоматически из main.

## Контакты и доступы
Supabase project: tmzqirzyvmnkzfmotlcj
Vercel project: metallportal
GitHub: investfreelife/metallportal
OpenRouter: ключ в .env.local
fal.ai: ключ нужно добавить в .env.local

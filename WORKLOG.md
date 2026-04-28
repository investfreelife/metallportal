# WORKLOG.md — Append-only журнал всех действий по проекту

> ⚠️ **ПРАВИЛА:**
> 1. Только дописываем В КОНЕЦ. Никогда не редактируем старые строки.
> 2. Никогда не удаляем строки. Этот файл — история проекта.
> 3. Каждое действие AI или разработчика = одна строка.
> 4. После записи в WORKLOG обновляем `STATE.md` разделы 5, 6, 7.

## Формат записи

```
YYYY-MM-DD HH:MM | <agent>           | <emoji> | <что сделано>                              | <files>
```

Поля:
- `agent` — кто действовал: `sergey`, `windsurf`, `claude`, `chatgpt`, `cron-audit`, `cron-morning`, и т.п.
- `emoji` — тип:
  - 📋 план / документ
  - 🆕 новая фича
  - ✅ деплой
  - 🔧 фикс
  - 🗑️ удаление
  - 🔬 эксперимент / замер
  - ⚙️ конфиг / миграция
  - 🚨 блокер
  - 📊 метрика / замер
- `что сделано` — одна короткая фраза, активный залог (не «было сделано», а «сделал»)
- `files` — список затронутых файлов через запятую, или `-` если без файлов

---

## Журнал

```
2026-04-26 18:00 | claude   | 📋 | Создал STATE.md и набор Week 1 артефактов                                         | STATE.md, MASTER.md, .windsurfrules, WORKLOG.md
2026-04-26 18:30 | claude   | 📋 | Подготовил 5 файлов Week 1: baseline, миграция, audit, validators, checklist      | docs/data-truth-baseline-2026-04.md, supabase/migrations/20260427_data_quality_queue.sql, scripts/audit_data_health.ts, harlan-ai/src/harlan_ai/validators.py, docs/supplier-selection-checklist.md
2026-04-26 19:00 | claude   | ⚙️ | Применил миграцию 20260427_data_quality_queue: таблицы + RLS + RPC                | supabase/migrations/20260427_data_quality_queue.sql
2026-04-26 19:30 | claude   | 📊 | Прогнал аудит данных: 5882 open issues (stale:5191, zero:259, mismatch:204)       | docs/data-truth-baseline-2026-04.md
2026-04-26 20:00 | claude   | ✅ | Интегрировал validate_pricing() в tasks.py::generate_kp + @with_validation        | harlan-ai/src/harlan_ai/tasks.py, harlan-ai/src/harlan_ai/validators.py
2026-04-26 20:30 | claude   | ✅ | Создал app/api/cron/audit-data-health/route.ts (hourly Vercel cron)               | app/api/cron/audit-data-health/route.ts, vercel.json
2026-04-27 09:10 | windsurf | ⚙️ | Положил STATE.md, .windsurfrules, WORKLOG.md в корень репо metallportal           | STATE.md, .windsurfrules, WORKLOG.md
2026-04-27 09:11 | windsurf | ⚙️ | Обновил vercel.json: cron audit-data-health schedule → 0 * * * * (hourly)        | vercel.json
2026-04-27 09:12 | windsurf | 📊 | Заполнил STATE.md §9 пятью baseline цифрами из docs/data-truth-baseline-2026-04.md | STATE.md
2026-04-27 09:13 | windsurf | 🚨 | 152-ФЗ pre-flight: 0/8 пунктов закрыто — 8 блокеров записаны в STATE.md §8        | STATE.md
2026-04-27 23:30 | windsurf | 🔧 | Фикс: AI-поиск fallback → supabaseSearch (убрал хардкоженный REF_PRICES)                           | app/api/ai/search/route.ts
2026-04-27 12:20 | windsurf | 🆕 | Создал app/privacy/page.tsx — Политика ПДн 152-ФЗ (10 разделов, по образцу Металлика/Металлсервис) | app/privacy/page.tsx
2026-04-27 12:21 | windsurf | 🆕 | Создал app/oferta/page.tsx — Публичная оферта купли-продажи (10 разделов, ст.437 ГК РФ)            | app/oferta/page.tsx
2026-04-27 12:22 | windsurf | 🆕 | Создал components/CookieBanner.tsx — баннер Принять/Отказаться + localStorage                      | components/CookieBanner.tsx
2026-04-27 12:23 | windsurf | 🔧 | SmartSearch.tsx: чекбокс согласия на ПДн + ссылка /privacy; кнопка заблокирована без ✓             | components/SmartSearch.tsx
2026-04-27 12:24 | windsurf | 🔧 | Footer /privacy /oferta реальные ссылки; layout.tsx: CookieBanner подключён                       | components/layout/Footer.tsx, app/layout.tsx
2026-04-27 17:08 | windsurf | ⚙️ | Скопирована миграция 20260504_supplier_pricing_v2 (11 таблиц + расширения price_items/contacts) | metallportal/supabase/migrations/20260504_supplier_pricing_v2.sql
2026-04-27 17:09 | windsurf | 🆕 | Скопированы 9 Python-модулей suppliers/_base + suppliers/metallservice (loader, config, types) | harlan-ai/src/harlan_ai/suppliers/
2026-04-27 17:10 | windsurf | 🆕 | CLI скрипт и smoke-тесты для парсера metallservice | harlan-ai/scripts/parse_supplier_pricing.py, harlan-ai/tests/suppliers/
2026-04-27 17:11 | windsurf | 📋 | 10 .xls прайсов Металлсервис + notes.md + фикстуры в tests/fixtures | data/suppliers/metallservice/2026-04-24/, harlan-ai/tests/fixtures/metallservice/
2026-04-27 17:12 | windsurf | ⚙️ | xlrd==1.2.0 + pyyaml==6.0.3 установлены; import MetallserviceLoader → OK | harlan-ai/pyproject.toml
2026-04-27 17:15 | windsurf | 🚨 | БЛОКЕР: миграция 20260504 упала — `suppliers` в БД уже существует (CRM-схема, 4 строки, нет tenant_id). Нужно решение Сергея: переименовать price_suppliers или объединить | STATE.md §8
2026-04-27 17:25 | windsurf | 🔧 | Фикс блокера: suppliers → price_suppliers во всей миграции (15 мест) + parse_supplier_pricing.py (1 место) | supabase/migrations/20260504_supplier_pricing_v2.sql, harlan-ai/scripts/parse_supplier_pricing.py
2026-04-27 17:26 | windsurf | ✅ | Миграция 20260504_supplier_pricing_v2 применена: price_suppliers ✅, CRM suppliers 4 строки ✅, seed metallservice ✅ | supabase/migrations/20260504_supplier_pricing_v2.sql
2026-04-27 17:30 | windsurf | 🔬 | pytest 16/16 PASSED (col_letter, source_ref, 10 реальных файлов, anomaly detector) | harlan-ai/tests/suppliers/
2026-04-27 17:35 | windsurf | 🔬 | Dry-run парсер: 10 OK, 0 failed, 13741 offers, 13445 аномалий (все unknown_subcat — норма для первого прогона), 3422 вопросов | harlan-ai/scripts/parse_supplier_pricing.py
2026-04-27 17:40 | windsurf | 🚨 | ШАГ 7 частично: 13741 offers записаны, parsing_questions=0, uploads stuck 'parsing'. supplier_price_uploads не имеет updated_at — RPC create_parsing_question + finalize_supplier_upload упали. Нужен фикс от Сергея | STATE.md §8
2026-04-27 18:05 | windsurf | 🔧 | Мини-миграция 20260504_2_supplier_uploads_align: ADD COLUMN updated_at + trigger set_updated_at | supabase/migrations/20260504_2_supplier_uploads_align.sql
2026-04-27 18:06 | windsurf | 🗑️ | Чистка: DELETE 10 stuck offers+uploads WHERE status='parsing' AND supplier=metallservice | БД
2026-04-27 18:10 | windsurf | ✅ | ШАГ 7 ПОЛНЫЙ: 10 uploads=pending_review | 13741 offers | 3422 questions open — Week 2 pipeline DONE | harlan-ai/scripts/parse_supplier_pricing.py
2026-04-27 19:00 | windsurf | 🆕 | Миграция 20260505_matcher_columns: 4 колонки в supplier_price_offers + RPC apply_match_results + расширение manual_review_queue | metallportal/supabase/migrations/20260505_matcher_columns.sql
2026-04-27 19:05 | windsurf | 🆕 | Пакет harlan_ai.matcher: types, normalizer, fuzzy, engine, review_queue, __init__ | harlan-ai/src/harlan_ai/matcher/
2026-04-27 19:10 | windsurf | 🆕 | CLI match_supplier_offers.py + тесты tests/matcher/ (20/20 PASSED) + rapidfuzz в pyproject.toml | harlan-ai/scripts/, harlan-ai/tests/matcher/
2026-04-27 19:15 | windsurf | 🚨 | Dry-run matcher 100% unmatched. products.dimensions NULL у 96%, unit теор.т у 79% offers vs 0 в products, offer.mark≠steel_grade семантика. Боевой прогон ЗАБЛОКИРОВАН до решения Сергея | STATE.md §8
2026-04-27 21:30 | windsurf | 🆕 | Smart key composer: grades.py, profile.py (15 Profile + classify), composer.py (compose + split_mark_field), 94 теста PASSED | harlan-ai/src/harlan_ai/matcher/{grades,profile,composer}.py
2026-04-27 21:32 | windsurf | 🔧 | Engine v3: load by supplier_id (все uploads), scope filter (FASTENER/NON_STEEL→out_of_scope), smart key через compose(), per-profile stats | harlan-ai/src/harlan_ai/matcher/engine.py
2026-04-27 21:34 | windsurf | 🆕 | Миграция 20260507000000_match_status_extra: CHECK constraint + out_of_scope + unmatched_unknown_profile | metallportal/supabase/migrations/
2026-04-27 21:36 | windsurf | 📊 | Dry-run v3: 13741 offers, out_of_scope=6368(46%), matched=370(5.3% matchable), unmatched=6129(44.6%), unknown=392(2.9%). Прогресс: от 0% до 5.3% matched. Ключевая проблема: products.dimensions NULL у 96% | /tmp/matcher_dryrun_v3.log
```

2026-04-27 15:20 | windsurf | 🔬 | Аудит products: скрипт audit_products.py + отчёт week2/PRODUCTS_AUDIT_REPORT.md. Итог: 3812 продуктов, dimensions=97.2%, steel_grade=73.4%, мусор=94, дубли=123, ОЦЕНКА=«осмысленный каталог», РЕКОМЕНДАЦИЯ=«чистить точечно» | harlan-ai/scripts/audit_products.py, harlan-ai/week2/PRODUCTS_AUDIT_REPORT.md

2026-04-27 22:54 | windsurf | 📋 | ТЗ #18 Шаг 1: создан classify_categories.py, запущен → CATEGORIES_CLASSIFICATION.md. DELETE=79кат/3675prod, KEEP=71кат/137prod | harlan-ai/scripts/classify_categories.py, harlan-ai/week2/CATEGORIES_CLASSIFICATION.md
2026-04-27 22:55 | windsurf | ⚙️ | ТЗ #18 шаблоны миграций: 20260508000000_products_catalog_fields.sql + 20260508000100_products_metallprokat_truncate.sql (PLACEHOLDER, не применять) | harlan-ai/migrations/

2026-04-28 06:04 | windsurf | 🆕 | ТЗ #19 catalog_sync: миграция products_catalog_sync + пакет catalog_sync (types/mc_parser/http_crawler/local_loader/upserter) + CLI sync_mc_catalog.py + 8 тестов PASSED | metallportal/supabase/migrations/20260519000000_products_catalog_sync.sql, harlan-ai/src/harlan_ai/catalog_sync/, harlan-ai/scripts/sync_mc_catalog.py, harlan-ai/tests/catalog_sync/, harlan-ai/pyproject.toml

<!-- Новые записи дописывать ниже этой строки -->

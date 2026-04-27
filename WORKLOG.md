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
```

<!-- Новые записи дописывать ниже этой строки -->

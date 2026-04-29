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
2026-04-26 18:00 | claude  | 📋 | Создан STATE.md и набор Week 1 артефактов | STATE.md, MASTER.md, .windsurfrules, WORKLOG.md
2026-04-26 18:30 | claude  | 📋 | Подготовлены 5 файлов Week 1: baseline, миграция, audit, validators, supplier checklist | docs/data-truth-baseline-2026-04.md, supabase/migrations/20260427_data_quality_queue.sql, scripts/audit_data_health.ts, harlan-ai/src/harlan_ai/validators.py, docs/supplier-selection-checklist.md
```

<!-- Новые записи дописывать ниже этой строки -->

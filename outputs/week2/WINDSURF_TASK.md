# Задание Windsurf — Week 2: Pipeline парсинга прайса Металлсервиса

> **Контекст в одной фразе:** строим backend-пайплайн который превращает 10 газетных .xls прайсов от поставщика в записи `supplier_price_offers` со ссылками на исходные ячейки и очередью вопросов менеджеру при аномалиях. Никаких автоматических обновлений `price_items` пока менеджер не одобрит — таково решение Сергея 2026-04-27.
>
> **Текущая фаза:** Phase 0 / Week 2.
> **Поставщик в этом раунде:** `metallservice` (Металлсервис, домен `mc.ru`).

---

## ОБЯЗАТЕЛЬНЫЙ ВХОДНОЙ РИТУАЛ

1. Прочитай `STATE.md` целиком.
2. Прочитай последние 20 строк `WORKLOG.md`.
3. В первом ответе на это задание подтверди:
   - текущая фаза (раздел 2 STATE.md)
   - последние 3 записи из WORKLOG
   - что собираешься сделать (этим задание = переписать одной строкой)
   - какие файлы затронешь
4. Только после подтверждения — приступай к шагам ниже.

---

## ИСТОЧНИК ФАЙЛОВ

Все файлы для копирования лежат в **`/Users/sergey/Library/Application Support/Claude/local-agent-mode-sessions/ce843ff5-9963-4435-a6e4-d55f6d8cc37b/963e8e99-177d-4e51-90ed-6006f14b532a/local_35ed87c0-c12e-47f6-a89b-953725babe97/outputs/week2/`** (далее называю `<OUTPUTS>/week2/`). Структура зеркалирует целевые пути в репо. Скопируй их буквально, ничего не дописывай и не «улучшай» без вопросов.

```
<OUTPUTS>/week2/
├── WINDSURF_TASK.md                                   ← это задание
├── migrations/
│   └── 20260504_supplier_pricing_v2.sql
└── harlan-ai/
    ├── src/harlan_ai/suppliers/
    │   ├── __init__.py
    │   ├── _base/
    │   │   ├── __init__.py
    │   │   ├── types.py
    │   │   ├── source_ref.py
    │   │   ├── anomaly.py
    │   │   └── staging.py
    │   └── metallservice/
    │       ├── __init__.py
    │       ├── config.yaml
    │       └── loader.py
    ├── scripts/
    │   └── parse_supplier_pricing.py
    └── tests/
        ├── __init__.py
        └── suppliers/
            ├── __init__.py
            ├── conftest.py
            └── test_metallservice_loader.py
```

---

## ШАГ 1. Применить миграцию

**Откуда → куда:**
```
<OUTPUTS>/week2/migrations/20260504_supplier_pricing_v2.sql
                  ↓
metallportal/supabase/migrations/20260504_supplier_pricing_v2.sql
```

**Применить:**
```bash
cd metallportal
supabase db push
```

**Верифицировать:**
```sql
-- В Supabase SQL editor выполнить:

-- 1. Появились 11 новых таблиц
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'supplier_%'
       OR table_name IN ('parsing_questions','customer_price_overrides',
                         'discount_policies','discount_review_queue'))
ORDER BY table_name;
-- Ожидаемый результат: 11 строк

-- 2. Seed Металлсервиса прошёл
SELECT slug, name, domain FROM suppliers
WHERE tenant_id = 'a1000000-0000-0000-0000-000000000001';
-- Ожидаемо: metallservice | Металлсервис | mc.ru

-- 3. Default discount_policy создана
SELECT policy_name, min_markup_pct, max_discount_pct
FROM discount_policies
WHERE tenant_id = 'a1000000-0000-0000-0000-000000000001';
-- Ожидаемо: 'Default 9% markup, no auto-discount' | 9.00 | 0.00

-- 4. price_items дополнились полями
SELECT column_name FROM information_schema.columns
WHERE table_name = 'price_items'
  AND column_name IN ('supplier_id','source_offer_id','supplier_price',
                      'markup_pct','unit','last_updated_from_supplier_at');
-- Ожидаемо: 6 строк

-- 5. contacts дополнились
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contacts'
  AND column_name IN ('customer_tier','default_discount_pct','notes_for_pricing');
-- Ожидаемо: 3 строки
```

**Если что-то не так:**
- Ошибка `relation already exists` → миграция частично применилась раньше. Сделать `DROP TABLE IF EXISTS <name> CASCADE;` для проблемной таблицы, потом снова `db push`.
- Ошибка `column already exists` → нормально (`ADD COLUMN IF NOT EXISTS` идемпотентен), но если падает — закомментируй конкретный ALTER, остальное применяй.

**После шага 1:**
- Допиши строку в `WORKLOG.md`:
  ```
  2026-04-27 HH:MM | windsurf | ⚙️ | Применена миграция 20260504_supplier_pricing_v2 (11 таблиц + расширения price_items/contacts) | metallportal/supabase/migrations/20260504_supplier_pricing_v2.sql
  ```
- Обнови `STATE.md` раздел 5 (СДЕЛАНО) — добавь свежую запись наверх.
- Коммит: `migration: supplier pricing v2 (11 tables for week 2 pipeline)`

---

## ШАГ 2. Скопировать Python-модули в harlan-ai

**Файлы (скопируй каждый из левого пути в правый):**

```
<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/__init__.py
    → harlan-ai/src/harlan_ai/suppliers/__init__.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/_base/__init__.py
    → harlan-ai/src/harlan_ai/suppliers/_base/__init__.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/_base/types.py
    → harlan-ai/src/harlan_ai/suppliers/_base/types.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/_base/source_ref.py
    → harlan-ai/src/harlan_ai/suppliers/_base/source_ref.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/_base/anomaly.py
    → harlan-ai/src/harlan_ai/suppliers/_base/anomaly.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/_base/staging.py
    → harlan-ai/src/harlan_ai/suppliers/_base/staging.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/metallservice/__init__.py
    → harlan-ai/src/harlan_ai/suppliers/metallservice/__init__.py

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/metallservice/config.yaml
    → harlan-ai/src/harlan_ai/suppliers/metallservice/config.yaml

<OUTPUTS>/week2/harlan-ai/src/harlan_ai/suppliers/metallservice/loader.py
    → harlan-ai/src/harlan_ai/suppliers/metallservice/loader.py
```

**Создать недостающие папки если их нет:**
```bash
mkdir -p harlan-ai/src/harlan_ai/suppliers/_base
mkdir -p harlan-ai/src/harlan_ai/suppliers/metallservice
```

**Установить зависимости** (добавить в `harlan-ai/requirements.txt` если нет):
```
xlrd<2.0      # для чтения .xls (BIFF8). xlrd>=2.0 убрал поддержку .xls
pyyaml>=6.0   # для config.yaml
```

Затем:
```bash
cd harlan-ai
pip install -r requirements.txt
```

**Проверить что импорты работают:**
```bash
cd harlan-ai
python -c "from harlan_ai.suppliers.metallservice import MetallserviceLoader; print('OK')"
```
Должно напечатать `OK`. Если падает на `ModuleNotFoundError` — посмотри `setup.py` / `pyproject.toml` и убедись что `src/` в путях.

**После шага 2:**
- WORKLOG: `... | windsurf | 🆕 | Добавлены модули suppliers/_base + suppliers/metallservice (loader, config, types) | harlan-ai/src/harlan_ai/suppliers/...`
- STATE раздел 5 обновить.
- Коммит: `feat(suppliers): metallservice loader + base infrastructure`

---

## ШАГ 3. Положить CLI скрипт и тесты

**Файлы:**
```
<OUTPUTS>/week2/harlan-ai/scripts/parse_supplier_pricing.py
    → harlan-ai/scripts/parse_supplier_pricing.py

<OUTPUTS>/week2/harlan-ai/tests/__init__.py
    → harlan-ai/tests/__init__.py

<OUTPUTS>/week2/harlan-ai/tests/suppliers/__init__.py
    → harlan-ai/tests/suppliers/__init__.py

<OUTPUTS>/week2/harlan-ai/tests/suppliers/conftest.py
    → harlan-ai/tests/suppliers/conftest.py

<OUTPUTS>/week2/harlan-ai/tests/suppliers/test_metallservice_loader.py
    → harlan-ai/tests/suppliers/test_metallservice_loader.py
```

Сделай скрипт исполняемым:
```bash
chmod +x harlan-ai/scripts/parse_supplier_pricing.py
```

**После шага 3:**
- WORKLOG: `... | windsurf | 🆕 | CLI скрипт и smoke-тесты для парсера metallservice | harlan-ai/scripts/parse_supplier_pricing.py, harlan-ai/tests/suppliers/...`
- Коммит: `feat(suppliers): CLI runner + smoke tests for metallservice parser`

---

## ШАГ 4. Положить тестовые фикстуры (10 прайсов)

Сергей дал 10 .xls файлов. Положи их в **двух местах**:

**1. Постоянное хранилище данных поставщика:**
```bash
mkdir -p data/suppliers/metallservice/2026-04-24
cp <PATH_TO_FILES>/cvetmet.xls          data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/engineering.xls      data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/kachestvst.xls       data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/krepezh.xls          data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/listovojprokat.xls   data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/metizy.xls           data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/nerzhaveika.xls      data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/profnastil.xls       data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/sortovojprokat.xls   data/suppliers/metallservice/2026-04-24/
cp <PATH_TO_FILES>/truby.xls            data/suppliers/metallservice/2026-04-24/
```

**2. Тестовые фикстуры** (для pytest):
```bash
mkdir -p harlan-ai/tests/fixtures/metallservice
ln -s ../../../../data/suppliers/metallservice/2026-04-24/cvetmet.xls         harlan-ai/tests/fixtures/metallservice/cvetmet.xls
ln -s ../../../../data/suppliers/metallservice/2026-04-24/engineering.xls     harlan-ai/tests/fixtures/metallservice/engineering.xls
# …и так для всех 10 файлов
```
(Если симлинки неудобны — просто скопируй файлы.)

Создай `data/suppliers/metallservice/notes.md`:
```markdown
# Поставщик: Металлсервис

## Контакты
- Менеджер: ___________ (Сергей заполнит)
- Телефон: +7 (495) 925-11-55
- Сайт: https://mc.ru
- Канал получения прайса: email (Сергей заполнит)

## Формат прайса
- 10 .xls файлов по категориям, формат BIFF8 (старый Excel)
- Каждый файл: один лист "Лист1", 9 колонок (2-колоночный газетный layout)
- Заголовок файла: телефон, домен, "Прайс-лист от <дата>"
- Иерархия: Раздел → Подкатегория → Заголовок столбцов → Данные
- Цены в ₽, НДС включён
- Единицы: т, теор.т, тыс.шт, м

## Особенности
- Артикулов нет. Идентификация: (раздел, подкатегория, марка, размер, ед.изм)
- На один ключ может быть 2-4 цены (разные склады/партии)
- "теор.т" vs "т" — теоретический vs реальный вес. Разные позиции.
- Подкатегория "УГОЛОК НИЗКОЛЕГИР" появляется в sortovojprokat — это уголок 09Г2С,
  цена в 1.4 раза выше обычного Ст3.
```

---

## ШАГ 5. Прогнать тесты

```bash
cd harlan-ai
pytest tests/suppliers/ -v
```

**Ожидаемый результат:**
- Юнит-тесты на `col_letter`, `make_source_ref` → ✅ pass
- Тесты на anomaly detector (`test_anomaly_detector_finds_*`) → ✅ pass
- Тесты на 10 файлах (`test_parser_runs_on_real_file[*]`) → ✅ pass (или skip если фикстуры не положены)
- `test_parser_detects_anomalies` → ✅ pass

Если что-то падает — НЕ переписывай парсер. Зафиксируй провал в `parsing_questions` (на этапе ручного запуска парсера эти аномалии вылезут как вопросы). Если падают чисто-кодовые тесты (на col_letter и т.п.) — проверь правильность копирования файлов.

**После шага 5:**
- WORKLOG: `... | windsurf | 🔬 | Тесты парсера metallservice прошли | harlan-ai/tests/suppliers/`
- Коммит: `test(suppliers): green smoke tests on 10 metallservice price files`

---

## ШАГ 6. Прогнать парсер на 10 реальных прайсах (DRY-RUN)

Перед боевым прогоном — dry-run, без записи в БД, чтобы увидеть что нашёл парсер:

```bash
cd harlan-ai
export SUPABASE_URL="$(supabase secrets get SUPABASE_URL || echo '')"
export SUPABASE_SERVICE_KEY="$(supabase secrets get SUPABASE_SERVICE_KEY || echo '')"
export TENANT_ID="a1000000-0000-0000-0000-000000000001"

python scripts/parse_supplier_pricing.py \
    --supplier metallservice \
    --files ../data/suppliers/metallservice/2026-04-24/*.xls \
    --dry-run
```

**Ожидаемый вывод (примерно):**
```
══════════════════════════════════════════════════════════════════════════════
BATCH <uuid>
══════════════════════════════════════════════════════════════════════════════
  Files OK:     10
  Files failed: 0
  Total offers parsed:    ~13000
  Total with anomalies:   ~500-2000  (значение зависит от чувствительности детектора)
  Total parsing_questions:~20-60

Per file:
  cvetmet.xls               parsed=  410  anom=  ...  Q=...
  engineering.xls           parsed= 1209  anom=  ...  Q=...
  ...
```

Если падает на каком-то файле — приложи stderr к WORKLOG записи и СТОП. Пиши в STATE.md раздел 8 (БЛОКЕРЫ) и спрашивай Сергея, не исправляй парсер сам.

---

## ШАГ 7. Прогнать парсер ПО-БОЕВОМУ (с записью в БД)

```bash
python scripts/parse_supplier_pricing.py \
    --supplier metallservice \
    --files ../data/suppliers/metallservice/2026-04-24/*.xls
```

После успеха проверь в Supabase:

```sql
-- 1. Загрузки
SELECT id, file_name, status, rows_parsed, rows_with_anomaly, questions_open
FROM supplier_price_uploads
WHERE supplier_id = (SELECT id FROM suppliers WHERE slug='metallservice')
ORDER BY uploaded_at DESC
LIMIT 20;
-- Ожидаемо: 10 строк, status='pending_review' (есть открытые вопросы)
-- или 'staged' (если аномалий не нашли — маловероятно)

-- 2. Спарсенные строки
SELECT count(*) FROM supplier_price_offers
WHERE supplier_id = (SELECT id FROM suppliers WHERE slug='metallservice');
-- Ожидаемо: ~13000

-- 3. Открытые вопросы
SELECT question_type, count(*)
FROM parsing_questions
WHERE supplier_id = (SELECT id FROM suppliers WHERE slug='metallservice')
  AND status = 'open'
GROUP BY question_type
ORDER BY 2 DESC;
-- Ожидаемо: 20-60 вопросов разных типов

-- 4. Семпл аномалий
SELECT section, subcategory, mark, dimension_raw, supplier_price,
       anomaly_reason, source_ref->>'cell' AS cell, source_ref->>'file' AS file
FROM supplier_price_offers
WHERE has_anomaly = true
LIMIT 20;
```

**После шага 7:**
- WORKLOG: `... | windsurf | 📊 | Парсер metallservice: 10 файлов, X спарсено, Y аномалий, Z вопросов | data/suppliers/metallservice/`
- STATE раздел 5 обновить со свежими цифрами.
- STATE раздел 6 (ПРЯМО СЕЙЧАС) обнови: `Сергей отвечает на parsing_questions в Supabase`.
- STATE раздел 7 (СЛЕДУЮЩИЙ ШАГ) обнови: `Сергей: ответить на parsing_questions, потом Claude напишет matcher для маппинга supplier_offer ↔ products`.
- Коммит: `data(suppliers): metallservice 2026-04-24 batch parsed (X offers, Y anomalies, Z questions)`

---

## ШАГ 8. Сводный отчёт Сергею

Открой Supabase SQL editor и выполни:

```sql
-- Сводка для отчёта
WITH s AS (
  SELECT id FROM suppliers WHERE slug='metallservice'
)
SELECT
  (SELECT count(*) FROM supplier_price_uploads WHERE supplier_id=(SELECT id FROM s)) AS total_uploads,
  (SELECT count(*) FROM supplier_price_offers  WHERE supplier_id=(SELECT id FROM s)) AS total_offers,
  (SELECT count(*) FROM supplier_price_offers  WHERE supplier_id=(SELECT id FROM s) AND has_anomaly=true) AS anomalies,
  (SELECT count(*) FROM parsing_questions      WHERE supplier_id=(SELECT id FROM s) AND status='open')   AS open_questions;
```

Затем создай и пришли Сергею короткое сообщение в формате:

```
Week 2 этап «Парсинг» — готово.

Цифры:
  files uploaded: 10
  offers parsed:  X
  anomalies:      Y
  open questions: Z

Что нужно от тебя:
  Открой Supabase → таблица parsing_questions → status='open'.
  Там Z вопросов от парсера. Ответь на каждый (UI пока нет, отвечай напрямую в БД).
  После всех ответов запустим matcher (Week 2 этап «Маппинг»).

Команды для проверки парсера:
  python harlan-ai/scripts/parse_supplier_pricing.py --list-questions
```

---

## ЧТО СЧИТАЕТСЯ «Week 2 ЭТАП ПАРСИНГА ГОТОВ»

- [ ] Миграция `20260504_supplier_pricing_v2.sql` применена. 11 новых таблиц + расширения существующих.
- [ ] Seed Металлсервиса в `suppliers` создан.
- [ ] Default `discount_policies` запись создана.
- [ ] 9 Python-файлов скопированы в `harlan-ai/src/harlan_ai/suppliers/`
- [ ] CLI `scripts/parse_supplier_pricing.py` скопирован, исполняется.
- [ ] Зависимости `xlrd<2.0` и `pyyaml` в `requirements.txt`, установлены.
- [ ] Все pytest-тесты зелёные (или skip из-за отсутствия фикстур, если ты не клал .xls в tests/fixtures).
- [ ] 10 .xls лежат в `data/suppliers/metallservice/2026-04-24/`
- [ ] `notes.md` создан в `data/suppliers/metallservice/`
- [ ] Парсер прогнан по-боевому, 10 записей в `supplier_price_uploads`
- [ ] `supplier_price_offers` содержит ~13 000 строк
- [ ] `parsing_questions` содержит 20-60 открытых вопросов
- [ ] WORKLOG обновлён минимум 7 записями за этот раунд
- [ ] STATE.md разделы 5/6/7 актуальны

После всего этого Сергей отвечает на вопросы парсера (это ручной шаг — UI ещё нет), и я (Claude) пишу matcher для следующего этапа.

---

## ЖЁСТКИЕ ОГРАНИЧЕНИЯ (см. `.windsurfrules`)

- НЕ редактируй `loader.py`, `anomaly.py`, `types.py` без согласования с Сергеем. Если тест падает — это не повод что-то перекрашивать «по логике». Падает = пиши в STATE раздел 8 и спрашивай.
- НЕ применяй цены из `supplier_price_offers` в `price_items` ни одной командой. Этот этап не относится к шагу парсинга. Связь произойдёт только после написания matcher и согласия менеджера.
- НЕ создавай новые products карточки автоматически из supplier_price_offers. Это правило Сергея от 2026-04-27: товары создаются и редактируются только по запросу.
- НЕ хардкодь SUPABASE_URL/SUPABASE_SERVICE_KEY — только через env.
- НЕ добавляй `print()` для отладки в loader-е. Используй `log.debug` / `log.info`.

---

## ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК

1. Запиши в STATE.md раздел 8 (БЛОКЕРЫ) формата:
   ```
   - 2026-04-27: <что мешает>, кто разблокирует: Сергей или Claude, к какому сроку: <дата>
   ```
2. Допиши строку в WORKLOG.md с emoji 🚨.
3. НЕ продолжай. Жди Сергея или Claude.

---

## ЧТО ДАЛЬШЕ (после твоего «готово»)

- **Шаг 9** (Сергей, ручной): отвечает на parsing_questions в Supabase. ~30-60 минут работы для 50 вопросов.
- **Шаг 10** (Claude): пишет `matcher.py` (supplier_offer ↔ product_id, fuzzy match, manual_review_queue).
- **Шаг 11** (Windsurf): UI в CRM `/admin/price-uploads` — список загрузок + diff + ответы на вопросы менеджером.
- **Шаг 12** (Claude): `email_generator` (запрос поставщику) + `pricing.py` (две цены в КП с правилами скидок).
- **Шаг 13** (Windsurf): UI в CRM `/admin/quotes/<id>` — таблица заявки с двумя ценами и сигналом админу при нарушении.

Это уже Week 3-4. Поэтапно.

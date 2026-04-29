# ТЗ Windsurf — matcher (Week 2, шаг 10)

**Контекст:** в БД лежит 13 741 распарсенных строк прайса Металлсервиса в `supplier_price_offers`. Нужен сопоставитель: кому из наших `products` соответствует каждая строка прайса. Без автосоздания товаров, без авто-применения цен. На неоднозначных совпадениях — пишем в `manual_review_queue`, ждём менеджера.

---

## ОБЯЗАТЕЛЬНЫЙ ВХОДНОЙ РИТУАЛ

1. Прочитай `STATE.md` целиком (если есть).
2. Прочитай последние 20 строк `WORKLOG.md` (если есть).
3. Прочитай `metallportal/supabase/migrations/20260504_supplier_pricing_v2.sql` — нужна точная схема `manual_review_queue` и `supplier_price_offers`.
4. Прочитай `harlan-ai/src/harlan_ai/suppliers/_base/types.py` и `harlan-ai/src/harlan_ai/suppliers/metallservice/loader.py` — синхронизировать терминологию (section/subcategory/mark/dimension_raw/unit).
5. Подтверди: текущая фаза (Phase 0 / Week 2 / шаг 10), что собираешься сделать (одной фразой), какие файлы затронешь.

---

## ЦЕЛЬ

Создать пакет `harlan_ai.matcher` который:
- Берёт offers из `supplier_price_offers` (по `upload_id` или по supplier+latest).
- Нормализует ключ `(section, subcategory, mark, dim, unit)`.
- Ищет совпадение в `products` (наш каталог).
- Записывает результат в `supplier_price_offers.matched_product_id` + `match_status` + `match_score`.
- Неоднозначные/без совпадений — кладёт в `manual_review_queue`.
- НЕ обновляет `price_items.supplier_price`. НЕ создаёт `products`. Это делает следующий этап после ручного approve.

---

## ШАГ 1. Мини-миграция

**Файл:** `metallportal/supabase/migrations/20260505_matcher_columns.sql`

Добавить в `supplier_price_offers`:
```sql
ALTER TABLE supplier_price_offers
  ADD COLUMN IF NOT EXISTS matched_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_status text CHECK (match_status IN ('exact','fuzzy','ambiguous','unmatched')),
  ADD COLUMN IF NOT EXISTS match_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_offers_match_status
  ON supplier_price_offers (supplier_id, match_status)
  WHERE match_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_matched_product
  ON supplier_price_offers (matched_product_id)
  WHERE matched_product_id IS NOT NULL;
```

RPC для записи результата (батчем, 1 транзакция на upload):
```sql
CREATE OR REPLACE FUNCTION apply_match_results(
  p_upload_id uuid,
  p_results jsonb  -- [{offer_id, product_id|null, status, score}]
) RETURNS int AS $$
DECLARE r jsonb; cnt int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    UPDATE supplier_price_offers
       SET matched_product_id = NULLIF((r->>'product_id'),'')::uuid,
           match_status       = r->>'status',
           match_score        = (r->>'score')::numeric,
           matched_at         = now()
     WHERE id = (r->>'offer_id')::uuid;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$ LANGUAGE plpgsql;
```

Применить: `cd metallportal && supabase db push`.

Верификация:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='supplier_price_offers'
  AND column_name IN ('matched_product_id','match_status','match_score','matched_at');
-- ожидаемо: 4 строки
```

---

## ШАГ 2. Пакет `harlan_ai.matcher`

**Файлы:**
```
harlan-ai/src/harlan_ai/matcher/__init__.py
harlan-ai/src/harlan_ai/matcher/types.py        # MatchCandidate, MatchResult, MatchStatus enum, MatcherConfig
harlan-ai/src/harlan_ai/matcher/normalizer.py   # normalize_mark, normalize_dim, normalize_unit, normalize_section
harlan-ai/src/harlan_ai/matcher/fuzzy.py        # rapidfuzz wrapper, score_pair(), top_candidates()
harlan-ai/src/harlan_ai/matcher/engine.py       # MatcherEngine(sb, tenant_id, config).run(upload_id|supplier_slug)
harlan-ai/src/harlan_ai/matcher/review_queue.py # write_to_review_queue(sb, offer, candidates, reason)
```

### types.py
```python
from enum import Enum
from dataclasses import dataclass
from typing import Optional
import uuid

class MatchStatus(str, Enum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    AMBIGUOUS = "ambiguous"
    UNMATCHED = "unmatched"

@dataclass
class MatchCandidate:
    product_id: uuid.UUID
    score: float           # 0..1
    matched_fields: dict   # {"mark": 0.95, "dim": 1.0, ...}

@dataclass
class MatchResult:
    offer_id: uuid.UUID
    status: MatchStatus
    product_id: Optional[uuid.UUID]
    score: float
    candidates: list[MatchCandidate]   # для AMBIGUOUS — все близкие; для UNMATCHED — пустой
    had_anomaly: bool                  # копируем из supplier_price_offers.has_anomaly

@dataclass
class MatcherConfig:
    exact_threshold: float = 1.0
    fuzzy_threshold: float = 0.90
    ambiguous_gap: float = 0.05    # если top1−top2 < этот gap → AMBIGUOUS
    candidate_limit: int = 5
```

### normalizer.py — словари синонимов

```python
UNIT_SYNONYMS = {
    "т": ["т", "тн", "тонн", "тонна", "тонны", "t"],
    "теор.т": ["теор.т", "теор т", "теоретическая тонна", "теор. т"],
    "шт": ["шт", "шт.", "штук", "штуки", "штука"],
    "тыс.шт": ["тыс.шт", "тыс шт", "тысяча штук", "тыс. шт"],
    "м": ["м", "м.п.", "м.п", "пог.м", "пог. м", "погонный метр", "метр", "метров"],
}

# Марки: только нормализация регистра/пробелов, БЕЗ группировки разных марок!
# Ст3сп5 != Ст3пс5 (спокойная vs полуспокойная — разная сталь)
# 09Г2С == 09г2с == 09 Г 2 С — это одна марка
# Просто: верхний регистр + remove all spaces
def normalize_mark(s: str) -> str: ...

# Размеры: 40х40х4 == 40*40*4 == 40 x 40 x 4 == 40X40X4 → "40x40x4" (ASCII)
# Десятичные: 1.5 == 1,5 → "1.5"
# Диаметры: Ø20 == d20 == ⌀20 → "20" (если контекст диаметра — но это уже из section)
def normalize_dim(s: str) -> str: ...

def normalize_unit(s: str) -> str:
    """Возвращает каноническую форму или исходную в нижнем регистре, если не нашли."""
    ...

def normalize_section(s: str) -> str:
    """UPPER + strip — без синонимов на этом этапе."""
    ...
```

### fuzzy.py
```python
from rapidfuzz import fuzz

def score_pair(offer_key: tuple, product_key: tuple) -> dict:
    """Возвращает {"mark": 0..1, "dim": 0..1, "section": 0..1, "unit": 0..1, "total": 0..1}.
    total = weighted: mark*0.4 + dim*0.4 + section*0.15 + unit*0.05.
    Но: section и unit ОБЯЗАНЫ совпадать точно (после нормализации) — иначе total=0.
    """
    ...

def top_candidates(offer_key, product_keys: list, limit: int = 5) -> list:
    """Сортирует по total desc, возвращает top-N."""
    ...
```

### engine.py — алгоритм

```python
class MatcherEngine:
    def __init__(self, sb, tenant_id: uuid.UUID, config: MatcherConfig = None): ...

    def run(self, upload_id: uuid.UUID = None, supplier_slug: str = None,
            dry_run: bool = False) -> MatcherRunResult:
        # 1. Загрузить offers
        offers = self._load_offers(upload_id, supplier_slug)

        # 2. Загрузить products (один раз, в память — их немного)
        products = self._load_products()  # включая product.section, mark, dimension, unit

        # 3. Сгруппировать offers по offer_key (одинаковые позиции = одинаковое решение)
        groups = self._group_offers_by_key(offers)

        # 4. Для каждой группы:
        results = []
        for offer_key, group_offers in groups.items():
            decision = self._decide(offer_key, products)
            for o in group_offers:
                results.append(MatchResult(
                    offer_id=o.id,
                    status=decision.status,
                    product_id=decision.product_id,
                    score=decision.score,
                    candidates=decision.candidates,
                    had_anomaly=o.has_anomaly,
                ))

        # 5. Записать в БД (если не dry_run): RPC apply_match_results(upload_id, results_jsonb)
        # 6. AMBIGUOUS + UNMATCHED → manual_review_queue (через review_queue.py)
        # 7. Вернуть сводку: {exact: N, fuzzy: N, ambiguous: N, unmatched: N}

    def _decide(self, offer_key, products) -> MatchDecision:
        # exact: точное совпадение всех 5 компонентов после normalize → score=1.0, EXACT
        # иначе: top_candidates → 
        #   top1.score >= fuzzy_threshold and (top1−top2 >= ambiguous_gap or нет top2): FUZZY
        #   top1.score >= fuzzy_threshold and top1−top2 < ambiguous_gap: AMBIGUOUS (top-5 в queue)
        #   top1.score < fuzzy_threshold: UNMATCHED
        ...
```

### review_queue.py
Записывает в `manual_review_queue` (схема — из v2 миграции, прочитай и используй точные поля). Для каждой записи:
- `tenant_id`, `supplier_id`, `upload_id`, `offer_id`
- `reason`: 'ambiguous_match' или 'no_match'
- `payload jsonb`: `{offer: {...}, candidates: [{product_id, score, name, ...}], offer_anomaly: bool}`
- `status='open'`

---

## ШАГ 3. CLI

**Файл:** `harlan-ai/scripts/match_supplier_offers.py`

Аргументы:
- `--upload-id <uuid>` (взаимоисключающий с --supplier)
- `--supplier <slug>` — матчит ВСЕ offers из последней `staged`/`pending_review` загрузки этого поставщика
- `--dry-run` — печатает сводку, не пишет в БД
- `--reset` — перед прогоном обнуляет matched_* поля у всех offers в скоупе
- `--verbose` — выводит каждое решение по offer

Вывод:
```
══════════════════════════════════════════════════════════════════════════════
MATCHER RUN | upload=<uuid> | offers=13741 | unique_keys=4280
══════════════════════════════════════════════════════════════════════════════
  exact      :   2104 (15.3%)
  fuzzy      :   6512 (47.4%)
  ambiguous  :   1903 (13.8%)
  unmatched  :   3222 (23.5%)
  ─────────────────────────────
  → manual_review_queue: 5125 записей
  → matched_product_id заполнен в supplier_price_offers: 8616 строк
```

---

## ШАГ 4. Тесты

**Файлы:**
```
harlan-ai/tests/matcher/__init__.py
harlan-ai/tests/matcher/conftest.py             # FakeSupabase + product fixtures
harlan-ai/tests/matcher/test_normalizer.py
harlan-ai/tests/matcher/test_fuzzy.py
harlan-ai/tests/matcher/test_engine.py
```

### test_normalizer.py — обязательные кейсы
```python
def test_normalize_mark_case_insensitive():
    assert normalize_mark("Ст3сп5") == normalize_mark("СТ3СП5") == normalize_mark("ст 3 сп 5")

def test_normalize_mark_keeps_distinct_grades():
    # Это разные стали — не должны слиться
    assert normalize_mark("Ст3сп5") != normalize_mark("Ст3пс5")

def test_normalize_dim_separators():
    assert normalize_dim("40х40х4") == normalize_dim("40*40*4") == normalize_dim("40 x 40 x 4") == "40x40x4"

def test_normalize_dim_decimal():
    assert normalize_dim("1,5") == normalize_dim("1.5") == "1.5"

def test_normalize_unit_synonyms():
    assert normalize_unit("тн") == normalize_unit("тонн") == "т"
    assert normalize_unit("м.п.") == normalize_unit("пог.м") == "м"
    assert normalize_unit("теор.т") == "теор.т"   # отдельная категория, не сливается с "т"

def test_normalize_unit_keeps_unknown():
    assert normalize_unit("неизвестно") == "неизвестно"
```

### test_engine.py — на синтетических products
```python
def test_exact_match(fake_sb, sample_products):
    # offer (УГОЛОК, УГОЛОК РАВНОПОЛОЧНЫЙ, Ст3сп5, 40x40x4, т) → product[5] exact
    ...

def test_fuzzy_match_separators(fake_sb, sample_products):
    # offer dim "40*40*4" должен сматчиться с product dim "40x40x4" с score=1.0 (после normalize)
    ...

def test_ambiguous_when_two_candidates_close(fake_sb, sample_products):
    # 2 продукта с одинаковой mark+dim → AMBIGUOUS, оба в manual_review_queue
    ...

def test_unmatched_when_no_candidates(fake_sb, sample_products):
    # mark="ВЫМЫШЛЕННАЯ-12345" → UNMATCHED, в manual_review_queue с reason='no_match'
    ...

def test_does_not_write_when_dry_run(fake_sb, sample_products):
    engine.run(dry_run=True)
    assert fake_sb.rpc_log == []  # никаких apply_match_results
```

---

## ШАГ 5. Зависимости

В `harlan-ai/requirements.txt` добавить:
```
rapidfuzz>=3.0,<4.0
```
(`python-Levenshtein` опционально — rapidfuzz сам тянет cffi-бэкенд.)

```bash
cd harlan-ai && pip install -r requirements.txt
pytest tests/matcher/ -v   # должно быть зелено
```

---

## ШАГ 6. Прогон по реальным данным (DRY-RUN)

```bash
cd harlan-ai
export SUPABASE_URL=...; export SUPABASE_SERVICE_KEY=...; export TENANT_ID=a1000000-0000-0000-0000-000000000001

python scripts/match_supplier_offers.py --supplier metallservice --dry-run --verbose | tee /tmp/matcher_dryrun.log
```
Покажи Сергею распределение exact/fuzzy/ambiguous/unmatched. Если unmatched > 50% — НЕ запускай боевой прогон. Сначала разбираемся с нормализатором (скорее всего, в `products` другая раскладка section/subcategory или другие синонимы).

## ШАГ 7. Боевой прогон

Только после согласия Сергея:
```bash
python scripts/match_supplier_offers.py --supplier metallservice
```

Проверка:
```sql
SELECT match_status, count(*) FROM supplier_price_offers
WHERE supplier_id=(SELECT id FROM price_suppliers WHERE slug='metallservice')
GROUP BY match_status ORDER BY 2 DESC;

SELECT reason, count(*) FROM manual_review_queue
WHERE supplier_id=(SELECT id FROM price_suppliers WHERE slug='metallservice')
  AND status='open'
GROUP BY reason;
```

---

## ЧТО СЧИТАЕТСЯ «MATCHER ГОТОВ»

- [ ] Миграция `20260505_matcher_columns.sql` применена. 4 новые колонки в `supplier_price_offers` + RPC `apply_match_results`.
- [ ] Пакет `harlan_ai.matcher` создан, импортируется.
- [ ] `rapidfuzz` в requirements.txt, установлен.
- [ ] Все pytest-тесты в `tests/matcher/` зелёные (минимум 12 тестов: 6 normalizer + 2 fuzzy + 4 engine).
- [ ] CLI `scripts/match_supplier_offers.py` запускается, --dry-run печатает сводку.
- [ ] Боевой прогон по metallservice прошёл, цифры в БД сходятся со сводкой dry-run.
- [ ] WORKLOG обновлён минимум 4 записями.
- [ ] STATE.md разделы 5/6/7 актуальны.

---

## ЖЁСТКИЕ ОГРАНИЧЕНИЯ

- НЕ создавай новые `products` автоматически. Только предложение в `manual_review_queue` с `reason='no_match'`.
- НЕ обновляй `price_items.supplier_price`. Это отдельный applier на следующем этапе.
- НЕ объединяй разные марки стали (Ст3сп ≠ Ст3пс). Ошибка тут = занижение цены менеджеру.
- НЕ добавляй ML/embeddings/spaCy. Только rapidfuzz + словари синонимов.
- НЕ редактируй `loader.py`, `anomaly.py`, `_base/types.py`. Если нужен новый тип — добавляй в `matcher/types.py`.
- НЕ хардкодь SUPABASE_URL/SUPABASE_SERVICE_KEY.

---

## ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК

1. Запиши в STATE.md раздел 8 (БЛОКЕРЫ): дата, что мешает, кто разблокирует.
2. WORKLOG строка с 🚨.
3. НЕ продолжай. Жди Сергея или Claude.

---

## ЧТО ДАЛЬШЕ (не твоя зона)

- **Шаг 11 (Windsurf):** UI `/admin/price-uploads` — список загрузок, открытые questions, manual_review_queue.
- **Шаг 11.5 (Сергей, ручной):** разбирает manual_review_queue — для каждой ambiguous выбирает product_id, для unmatched либо создаёт product, либо помечает «не наш ассортимент».
- **Шаг 12 (Codex):** `applier.py` — после approve менеджером записывает `supplier_price_offers.supplier_price` в `price_items.supplier_price` + `markup_pct` → `unit_price`.

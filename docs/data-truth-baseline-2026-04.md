# Data Truth — Baseline (Week 1, Day 1)

> **Правило:** сначала замер, потом цели. Никаких gate-метрик, пока не зафиксирован старт.
> Файл коммитится в репо как `docs/data-truth-baseline-2026-04.md`. Каждый месяц — новая копия. Сравниваем.

---

## 0. Pre-flight: 152-ФЗ + юр. обвязка (до запуска любого трафика)

- [ ] Оферта на сайте опубликована (B2B + B2C версии)
- [ ] Политика обработки ПДн (152-ФЗ) на `/privacy`
- [ ] Согласие на обработку ПДн в формах SmartSearch + checkout (чекбокс с ссылкой на политику)
- [ ] Уведомление в Роскомнадзор подано (или зафиксировано, что не требуется по ст. 22 ч. 2)
- [ ] PII логируется только в платных моделях (qwen3.5-flash); проверка флага `pii=True` в `tasks.py::_llm()`
- [ ] OpenRouter — оценено, попадает ли под обработчика ПДн; если да — DPA подписан или PII туда не уходит
- [ ] Cookie-баннер с согласием (если используются Я.Метрика + PostHog)
- [ ] Договор оферты на покупку металлопроката (для B2C: ст. 437 ГК; для B2B: рамочный)

**Без этого Week 1 не закрывается.** Один штраф РКН по ст. 13.11 КоАП = $1000–6000.

---

## 1. Состояние товаров

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE seo_text IS NULL OR seo_text = '') AS no_seo_text,
  COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '') AS no_image,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM price_items pi WHERE pi.product_id = products.id
  )) AS no_price_link
FROM products;
```

| Метрика | Значение | % |
|---|---|---|
| total | _____ | 100 |
| no_seo_text | _____ | ___ |
| no_image | _____ | ___ |
| no_price_link | _____ | ___ |

---

## 2. Свежесть цен (главное число всего проекта)

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days')  AS fresh_7d,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') AS fresh_30d,
  COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '90 days') AS rotten_90d,
  COUNT(*) FILTER (WHERE in_stock = true) AS in_stock_rows
FROM price_items;
```

| Метрика | Значение | % |
|---|---|---|
| total_rows | _____ | 100 |
| fresh_7d | _____ | ___ |
| fresh_30d | _____ | ___ |
| rotten_90d | _____ | ___ |
| in_stock | _____ | ___ |

**Правило цели Week 2:** старт + 50% от gap до 90%.
Пример: если `fresh_7d = 20%`, цель = `20 + (90−20)×0.5 = 55%`. Не «80%».

---

## 3. Воронка за 90 дней

```sql
SELECT stage, COUNT(*) AS deals_n, SUM(amount) AS total_amount, AVG(amount) AS avg_check
FROM deals
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY stage
ORDER BY deals_n DESC;
```

| stage | deals_n | total_amount | avg_check |
|---|---|---|---|
| | | | |

**Conversion (рассчитать вручную):** won / new = ____%

---

## 4. Источники лидов

```sql
SELECT source, COUNT(*) AS n, ROUND(AVG(ai_score)) AS avg_score
FROM contacts
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY source
ORDER BY n DESC;
```

| source | n | avg_score |
|---|---|---|
| | | |

---

## 5. Скорость и стабильность AI

```sql
SELECT
  agent_name,
  COUNT(*) AS calls,
  ROUND(AVG(duration_ms)) AS avg_ms,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  COUNT(*) FILTER (WHERE NOT success) AS failures
FROM ai_cost_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_name
ORDER BY calls DESC;
```

| agent_name | calls | avg_ms | p50_ms | p95_ms | failures |
|---|---|---|---|---|---|
| | | | | | |

---

## Цели Week 1–4 (заполняем ПОСЛЕ замеров)

| Метрика | Сегодня | Цель к концу Week 2 | Цель к концу Week 4 |
|---|---|---|---|
| `fresh_7d` (% свежих цен) | ___% | ___% (старт + 50% gap до 90%) | ___% |
| P95 search latency | ___ ms | без изменений (фокус на данных) | <2000 ms |
| Conversion (won/new) | ___% | без изменений | без изменений |
| Pre-flight 152-ФЗ | ___ из 8 | 8 из 8 | 8 из 8 |

---

## Что делать с этим файлом

1. Заполнить все таблицы цифрами в понедельник.
2. Закоммитить как `docs/data-truth-baseline-2026-04.md`.
3. Отправить мне цифры из всех 5 таблиц одним сообщением.
4. Я возвращаю реалистичные цели для Week 2.

# STATE.md — Harlan Steel: канонический источник истины

> **Версия:** 2026-04-27 12:25 МСК
> **Этот файл — единственная правда о состоянии проекта.**
> Любой AI/разработчик ПЕРЕД работой читает целиком. ПОСЛЕ работы обновляет разделы 3, 5, 6, 7.
> Полная документация (история, схема БД, детали) — в `MASTER.md`. Этот файл — короткий снимок «где мы стоим».

---

## 1. ЦЕЛЬ (не менять без Сергея)

Стать №1 в РФ по доле AI-завершённых сделок (полный цикл запрос → КП → счёт без вмешательства менеджера) в металлоторговле к месяцу 18.

**Метрика успеха:** ≥40% сделок проходят без касания менеджером к концу 18 месяца.

---

## 2. ТЕКУЩАЯ ФАЗА

**Phase 0 — Истина данных** (Week 1 из 4)
**Дата старта:** 2026-04-27
**Дата завершения фазы (план):** 2026-05-25

---

## 3. ПЛАН — 24 недели (отмечать [x] после завершения)

```
PHASE 0 — Истина данных (Weeks 1-4)
  [ ] Week 1 — Аудит, миграция data_quality_queue, validator, 152-ФЗ pre-flight ◄ ТЕКУЩАЯ
  [ ] Week 2 — Pipeline 1 поставщика (loader/normalizer/sync)
  [ ] Week 3 — pgvector + гибридный поиск (BM25 + vector + reranker)
  [ ] Week 4 — Streaming UI + Upstash Redis cache

PHASE 1 — Координация агентов (Weeks 5-6)
  [ ] Week 5 — agent_log + recall()/record() + idempotency
  [ ] Week 6 — Streaming UI в SmartSearch + первый замер P95 < 2s

PHASE 2 — SEO-машина (Weeks 7-14)
  [ ] Weeks 7-10 — Programmatic seo_text для 12k SKU + Schema.org
  [ ] Weeks 11-14 — Hub-страницы, internal linking, Я.Вебмастер, Я.Директ

PHASE 3 — Поставщики и AI-консультант (Weeks 15-22)
  [ ] Weeks 15-16 — Поставщики №2 и №3
  [ ] Weeks 17-20 — Multi-turn AI-консультант + agent_memory с vector
  [ ] Weeks 21-22 — Авто-CPQ + ЮKassa + PDF счета

PHASE 4 — Личный кабинет и оплата (Weeks 23-24)
  [ ] Weeks 23-24 — Личный кабинет B2B, история, повтор заказа
```

**Gate между фазами:** не выполнено условие — следующую неделю не начинаем. Условия в `MASTER.md` раздел 10.

---

## 4. АРХИТЕКТУРА (минимальная карта)

```
Клиент (сайт/Telegram)
   ↓
Vercel Edge (Next.js, кэш, streaming)
   ↓
Railway (FastAPI, harlan-ai/tasks.py — все агенты как функции)
   ↓
Supabase (Postgres + pgvector + Realtime + RLS по tenant_id)
   ↓
External: OpenRouter (Qwen3), Upstash Redis, Resend, Telegram, ЮKassa
```

**Принципы (не нарушать):**
- 1 функция = 1 LLM вызов = известная стоимость (см. `MASTER.md` §5)
- PII (имена, телефоны) только в платных моделях (qwen3.5-flash)
- Все вызовы LLM логируются в `ai_cost_log`
- Любая цена клиенту проходит `validate_pricing()`
- Никаких автономных агентов без human-in-the-loop через `ai_queue`
- Мультитенантность: `tenant_id` во всех таблицах, RLS включён

---

## 5. СДЕЛАНО (последние 10, новые сверху)

```
2026-04-27  🚨  Шаг 7 частично: 13741 offers в БД, но parsing_questions=0 (все RPC упали updated_at), uploads stuck 'parsing'
2026-04-27  ✅  Week 2 шаг 1: миграция 20260504_supplier_pricing_v2 применена (price_suppliers + 10 таблиц)
2026-04-27  🆕  Week 2 шаги 2-4: 9 Python-модулей suppliers/, CLI, тесты, 10 .xls прайсов — всё на месте
2026-04-27  �  Фикс AI-поиска: fallback заменён с хардкоженных REF_PRICES на supabaseSearch (реальный прайс)
2026-04-27  🆕  152-ФЗ: /privacy + /oferta страницы, CookieBanner, чекбокс ПДн в SmartSearch, Footer ссылки
2026-04-27  ⚙️  Windsurf: STATE.md + .windsurfrules + WORKLOG.md → корень репо; vercel.json cron → hourly
2026-04-27  📊  5 baseline цифр в STATE.md §9: fresh_7d=0%, no_price=1.2%, no_seo=100%, mismatch=5.4%, no_img=4.7%
2026-04-27  🚨  152-ФЗ pre-flight: 0/8 закрыто — все 8 пунктов записаны как блокеры в раздел 8
2026-04-27  ✅  validate_pricing() интегрирован в tasks.py::generate_kp + @with_validation на search_metal
2026-04-26  ✅  Аудит прогнан: 5 882 DQ issues (stale:5191 warn, zero_price:259 crit, mismatch:204, missing:47+181)
2026-04-26  ✅  Миграция 20260427_data_quality_queue.sql применена в Supabase
2026-04-26  📋  Подготовлены артефакты Week 1: baseline, миграция, audit, validators, supplier checklist, cron route
2026-04-26  📋  Создан STATE.md и регламент работы AI с проектом
```

**Формат записи:** `YYYY-MM-DD  <emoji>  что сделано (одна строка)`. Эмодзи: 📋 план, ✅ деплой, 🔧 фикс, 🆕 новая фича, 🗑️ удалено.

---

## 6. ПРЯМО СЕЙЧАС

Week 2 шаги 1-6 выполнены. Шаг 7 частично: 13741 offers в БД, но parsing_questions=0 и uploads stuck 'parsing'.
**БЛОКЕР**: `supplier_price_uploads` уже существовала без `updated_at`. RPC-функции её референцируют. Нужна миграция добавления колонки.

---

## 7. СЛЕДУЮЩИЙ ШАГ (одна задача)

**Кто:** Сергей → решение, потом Windsurf
**Что:** Выбрать способ фикса `updated_at` в `supplier_price_uploads`:
  - Вариант А: `ALTER TABLE supplier_price_uploads ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();` (новая мини-миграция)
  - Вариант Б: убрать `updated_at = now()` из трёх RPC-функций (безопаснее)
После фикса — почистить текущий батч (удалить 10 'parsing' записей) и повторить шаг 7.
**Когда готово:** После фикса миграции → все 13741 offers + 3422 questions + финализированные uploads.

---

## 8. БЛОКЕРЫ

```
- 2026-04-27: [ЗАКРЫТО ✅] Политика обработки ПДн (152-ФЗ) на /privacy — app/privacy/page.tsx создан
- 2026-04-27: [ЗАКРЫТО ✅] Договор оферты — app/oferta/page.tsx создан (ст.437 ГК РФ)
- 2026-04-27: [ЗАКРЫТО ✅] Согласие в SmartSearch — чекбокс + ссылка /privacy добавлены
- 2026-04-27: [ЗАКРЫТО ✅] Cookie-баннер — CookieBanner.tsx с Принять/Отказаться подключён
- 2026-04-27: [ЗАКРЫТО ✅] PII в платных моделях — tasks.py::generate_kp/score_lead используют MODEL_CHEAP (qwen3.5-flash)

- 2026-04-27: [БЛОКЕР ⚠️] ИНН/ОГРН/р-счёт не заполнены в /privacy и /oferta. Сергей → до деплоя.
- 2026-04-27: [БЛОКЕР ⚠️] Уведомление в РКН не подано. Сергей → asap (ст.22 152-ФЗ).
- 2026-04-27: [БЛОКЕР ⚠️] DPA с OpenRouter не проверен. Сергей → проверить openrouter.ai/privacy.
- 2026-04-27: [ЗАКРЫТО ✅] Week 2 блокер suppliers → переименована в `price_suppliers` в миграции + Python-коде. CRM-таблица suppliers нетронута (4 строки).
- 2026-04-27: [БЛОКЕР 🚨] `supplier_price_uploads` уже существовала без `updated_at`. Фикс: `ALTER TABLE supplier_price_uploads ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();` + повторить шаг 7. Или убрать `updated_at = now()` из RPC. Решение от Сергея.
```

Если появляется блокер — формат: `- YYYY-MM-DD: что мешает, кто разблокирует, к какому сроку`.

---

## 9. КЛЮЧЕВЫЕ ЦИФРЫ (snapshot)

```
Дата замера: 2026-04-26 (аудит прогнан, данные реальные)

Свежесть данных:
  fresh_7d (% price_items < 7 дней):              0 %     [цель Week 2: 45%]
  no_price_link (% products без price_items):     1.2 %   (47 из 3 812)
  no_seo_text (% products без seo_text):          100 %   (3 812 из 3 812)
  price_mismatch_cross_supplier (% SKU > 10%):    5.4 %   (204 SKU)
  missing_image (% products без image_url):       4.7 %   (181 из 3 812)

Скорость:
  P95 search latency:                             60 863 ms   ⚠️ [цель Week 4: < 10 000 ms]
  AI failures за 30 дней:                         1 (bezos)

Воронка (90 дней):
  total deals:                                    2
  conversion (won/new):                           0 %
  avg check:                                      130 000 ₽

AI Queue:
  pending:                                        0
  approved за неделю:                             0

DQ Queue (open issues на 2026-04-26):
  critical / zero_price:                          259
  critical / missing_price:                       47
  critical / price_mismatch:                      118
  warning  / stale_price:                         5 191
  warning  / price_mismatch:                      86
  info     / missing_image:                       181
  ИТОГО OPEN:                                     5 882
```

Обновляется раз в неделю в пятницу.

---

## 10. ПРАВИЛА РАБОТЫ ДЛЯ AI/РАЗРАБОТЧИКА

**Перед работой:**
1. Прочитать STATE.md ЦЕЛИКОМ. Если не читал — не начинай.
2. Прочитать `MASTER.md` разделы 4 (БД), 5 (AI), 11 (известные проблемы).
3. Подтвердить Сергею в одном абзаце: цель, текущая фаза, следующий шаг.

**Во время работы:**
4. Не выходить за рамки текущей фазы (раздел 2).
5. Не менять цель (раздел 1) и архитектурные принципы (раздел 4) без Сергея.
6. Все миграции БД — в `supabase/migrations/<YYYYMMDD>_<name>.sql`.
7. Все промпты — в файлах (`prompts/*.txt`), не inline в коде.
8. Любая отправка КП клиенту — через `validate_pricing()`.
9. Не использовать LangGraph / CrewAI кроме `document_crew` (есть прецедент несовместимости с Qwen3).

**После работы:**
10. Дописать одну строку в раздел 5 (СДЕЛАНО).
11. Перезаписать раздел 6 (ПРЯМО СЕЙЧАС).
12. Поставить раздел 7 (СЛЕДУЮЩИЙ ШАГ) для следующего исполнителя.
13. Если появился блокер — добавить в раздел 8.
14. Закоммитить с сообщением: `state: <короткое описание>`.

**Когда сомневаешься:**
15. Спрашивать Сергея. Не угадывать. Не додумывать. Не «по аналогии».

---

## 11. КАК ПОДКЛЮЧАТЬ AI К ПРОЕКТУ (entry prompt)

Когда даёшь любому AI (Windsurf, Claude, Cursor, ChatGPT) путь к проекту, скажи дословно:

> **«Прочитай `STATE.md` полностью. Не начинай работу пока не прочёл целиком. Перескажи в одном абзаце: цель проекта, текущая фаза, что прямо сейчас в работе, следующий шаг. Только после этого жди задачу. Не интерпретируй цель — она зафиксирована в разделе 1. Не выходи за рамки текущей фазы. После работы обновляй разделы 5, 6, 7 этого файла.»**

Если ответ AI не совпадает с этим файлом — он не прочёл, либо домысливает. Не давай ему задачу до правильного пересказа.

---

## ССЫЛКИ

- Полная документация: [`MASTER.md`](./MASTER.md)
- Артефакты Week 1: `docs/data-truth-baseline-2026-04.md`, `supabase/migrations/20260427_data_quality_queue.sql`, `scripts/audit_data_health.ts`, `harlan-ai/src/harlan_ai/validators.py`, `docs/supplier-selection-checklist.md`
- Поставщики: `data/suppliers/`
- Чек-лист 152-ФЗ: внутри `docs/data-truth-baseline-2026-04.md` раздел 0

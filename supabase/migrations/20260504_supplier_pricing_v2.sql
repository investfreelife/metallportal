-- ============================================================================
-- Migration: 20260504_supplier_pricing_v2.sql
-- Phase 0 / Week 2 — Pipeline загрузки прайса поставщика → две цены в КП
-- ============================================================================
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ:
--   1. Создаёт справочник suppliers (если ещё нет)
--   2. Журнал загрузок прайсов (supplier_price_uploads)
--   3. Staging-таблицу для сырых строк прайса со ссылкой на ячейку (supplier_price_offers)
--   4. Обучаемые правила парсинга (supplier_parsing_rules)
--   5. Очередь вопросов парсера к менеджеру (parsing_questions)
--   6. Маппинг supplier_offer ↔ products (supplier_sku_mapping)
--   7. Запросы поставщикам и их ответы (supplier_quote_requests/responses)
--   8. Customer-specific цены и правила скидок (customer_price_overrides, discount_policies)
--   9. Очередь нарушений правил скидок для админа (discount_review_queue)
--   10. Расширяет price_items полями supplier_id, markup_pct, source_offer_id
--   11. Расширяет contacts полями discount_pct, customer_tier
--
-- ПРИНЦИПЫ:
--   - Все таблицы RLS по tenant_id
--   - Все типы через CHECK constraints (не enum — проще менять)
--   - Никакой каскад на удаление products — только SET NULL
--   - Все timestamp в UTC, default now()
--   - Идемпотентность через CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. SUPPLIERS — справочник поставщиков
-- ────────────────────────────────────────────────────────────────────────────
-- Имя поставщика НЕ публикуется клиенту. is_public_name=false по умолчанию.
-- В CRM менеджер видит. На сайте/КП клиенту — только обезличено "Поставщик 1".

CREATE TABLE IF NOT EXISTS suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  slug            text NOT NULL,
  name            text NOT NULL,
  domain          text,
  is_active       boolean NOT NULL DEFAULT true,
  is_public_name  boolean NOT NULL DEFAULT false,
  contact_email   text,
  contact_phone   text,
  contact_person  text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_active
  ON suppliers (tenant_id, is_active);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_tenant_isolation ON suppliers;
CREATE POLICY suppliers_tenant_isolation ON suppliers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Сразу seed Металлсервиса для текущего тенанта
INSERT INTO suppliers (tenant_id, slug, name, domain, contact_email, notes)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'metallservice',
  'Металлсервис',
  'mc.ru',
  NULL, -- заполнить менеджером
  'Основной поставщик, газетный 2-колоночный .xls прайс, 10 категорий'
)
ON CONFLICT (tenant_id, slug) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. SUPPLIER_PRICE_UPLOADS — журнал загрузок прайса
-- ────────────────────────────────────────────────────────────────────────────
-- Один файл = одна запись. Содержит метаданные о загрузке (кто, когда, статус).
-- Если в одном «обновлении прайса» поставщик прислал 10 файлов —
-- это 10 записей в supplier_price_uploads, объединённые batch_id.

CREATE TABLE IF NOT EXISTS supplier_price_uploads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  batch_id            uuid NOT NULL,                      -- группирует загрузки одного "обновления"
  file_name           text NOT NULL,
  file_storage_path   text,                                -- путь в Supabase Storage
  file_hash_sha256    text NOT NULL,                       -- защита от дубль-загрузки
  file_size_bytes     bigint,
  category_hint       text,                                -- "cvetmet", "truby", и т.п. — из имени файла
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending',          -- файл загружен, парсер ещё не запущен
                        'parsing',          -- парсер работает
                        'pending_review',   -- спарсено, есть открытые parsing_questions
                        'staged',           -- все вопросы закрыты, готов к матчингу
                        'matching',         -- matcher работает
                        'pending_apply',    -- diff собран, ждёт apply менеджером
                        'applied',          -- цены залиты в price_items
                        'failed',           -- парсер упал (см. error_message)
                        'rejected'          -- менеджер отклонил
                      )),
  rows_total          integer NOT NULL DEFAULT 0,
  rows_parsed         integer NOT NULL DEFAULT 0,
  rows_with_anomaly   integer NOT NULL DEFAULT 0,
  rows_applied        integer NOT NULL DEFAULT 0,
  questions_total     integer NOT NULL DEFAULT 0,
  questions_open      integer NOT NULL DEFAULT 0,
  error_message       text,
  uploaded_by         uuid,                                -- contacts/users.id
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  parsed_at           timestamptz,
  applied_at          timestamptz,
  applied_by          uuid,
  UNIQUE (tenant_id, supplier_id, file_hash_sha256)
);

CREATE INDEX IF NOT EXISTS idx_uploads_tenant_status
  ON supplier_price_uploads (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_uploads_batch
  ON supplier_price_uploads (batch_id);

ALTER TABLE supplier_price_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uploads_tenant_isolation ON supplier_price_uploads;
CREATE POLICY uploads_tenant_isolation ON supplier_price_uploads
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 3. SUPPLIER_PRICE_OFFERS — staging сырых строк прайса
-- ────────────────────────────────────────────────────────────────────────────
-- Каждая распарсенная строка хранит ССЫЛКУ НА ИСХОДНУЮ ЯЧЕЙКУ (source_ref).
-- Менеджер в diff-UI кликает → открывается прайс с подсветкой нужной строки.
-- НИЧЕГО из этой таблицы НЕ попадает в price_items автоматически —
-- только после apply через matcher и согласия менеджера.

CREATE TABLE IF NOT EXISTS supplier_price_offers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  upload_id           uuid NOT NULL REFERENCES supplier_price_uploads(id) ON DELETE CASCADE,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- иерархия из прайса (как было в файле)
  section             text,           -- "Сортовой прокат", "Цветной прокат", "Трубы"
  subcategory         text,           -- "АРМАТУРА", "УГОЛОК", "УГОЛОК НИЗКОЛЕГИР"
  mark                text,           -- "кл А1 А240", "Ст3 н/обр", "Анкер забивной 12"
  dimension_raw       text,           -- "12", "8 ; 12; 16", "25x25 6м", "DN15"
  dimension_normalized jsonb,         -- {"diameter":[12], "length":null} после normalizer
  unit                text,           -- "т", "теор.т", "тыс.шт", "м"
  supplier_price      numeric(14, 2),
  supplier_currency   text NOT NULL DEFAULT 'RUB',
  vat_included        boolean NOT NULL DEFAULT true,        -- по правилу metallservice: включён
  in_stock_supplier   boolean,                              -- если поставщик указывает остаток

  -- ИСТОЧНИК (для трассировки)
  source_ref          jsonb NOT NULL,
  -- {"file":"sortovojprokat.xls","sheet":"Лист1","row":125,"col":"H","cell":"H125"}

  raw_row             jsonb,                                -- весь массив ячеек строки

  -- статус
  status              text NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN (
                        'pending_review',  -- есть открытые вопросы или аномалия
                        'staged',          -- готов к матчингу
                        'mapped',          -- найден product_id, ждёт apply
                        'applied',         -- залит в price_items
                        'rejected',        -- менеджер отверг строку
                        'duplicate'        -- идентичная строка уже есть
                      )),
  has_anomaly         boolean NOT NULL DEFAULT false,
  anomaly_reason      text,                                 -- "price_jump", "new_subcategory", "unknown_unit"

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offers_upload
  ON supplier_price_offers (upload_id);
CREATE INDEX IF NOT EXISTS idx_offers_supplier_status
  ON supplier_price_offers (supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_anomaly
  ON supplier_price_offers (tenant_id, has_anomaly) WHERE has_anomaly = true;
CREATE INDEX IF NOT EXISTS idx_offers_section_subcat
  ON supplier_price_offers (supplier_id, section, subcategory);

ALTER TABLE supplier_price_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offers_tenant_isolation ON supplier_price_offers;
CREATE POLICY offers_tenant_isolation ON supplier_price_offers
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 4. SUPPLIER_PARSING_RULES — обучаемые правила парсера
-- ────────────────────────────────────────────────────────────────────────────
-- На первой загрузке менеджер отвечает на вопросы парсера.
-- Ответы сохраняются здесь как правила. На следующих загрузках того же
-- поставщика парсер применяет правила автоматически.

CREATE TABLE IF NOT EXISTS supplier_parsing_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  rule_type       text NOT NULL
                  CHECK (rule_type IN (
                    'header_alias',           -- "Полка"="ширина", "Наим."="наименование"
                    'subcategory_known',      -- "УГОЛОК НИЗКОЛЕГИР" — это известная подкат, считаем как UGOLOK_LOWALLOY
                    'duplicate_strategy',     -- что делать с дубликатами цен (min/median/keep_all)
                    'unit_alias',             -- "теор.т"="theoretical_ton"
                    'price_jump_threshold',   -- какой % считать аномалией для (subcat, mark)
                    'mark_normalization',     -- "Ст3 н/обр" = "Ст3"+"unobr"
                    'dimension_split',        -- "8 ; 12; 16" → 3 строки
                    'category_unit_default',  -- "АРМАТУРА"→"т", "Крепеж"→"тыс.шт"
                    'ignore_pattern'          -- строки матчащие regex игнорировать
                  )),
  rule_key        text NOT NULL,              -- человекочитаемый ключ
  rule_value      jsonb NOT NULL,             -- параметры правила
  scope           text,                       -- "global"|"section"|"subcategory"|"mark"
  scope_value     text,                       -- например "АРМАТУРА"
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id, rule_type, rule_key, scope, scope_value)
);

CREATE INDEX IF NOT EXISTS idx_rules_supplier
  ON supplier_parsing_rules (supplier_id) WHERE is_active = true;

ALTER TABLE supplier_parsing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rules_tenant_isolation ON supplier_parsing_rules;
CREATE POLICY rules_tenant_isolation ON supplier_parsing_rules
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 5. PARSING_QUESTIONS — открытые вопросы парсера к менеджеру
-- ────────────────────────────────────────────────────────────────────────────
-- Каждая аномалия → запись здесь. Менеджер в CRM видит вопрос с контекстом
-- (фрагмент исходных строк, source_ref) и отвечает. Ответ:
--   а) применяется к offer-ам этой загрузки
--   б) сохраняется как supplier_parsing_rule (если "запомнить навсегда")

CREATE TABLE IF NOT EXISTS parsing_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  upload_id       uuid NOT NULL REFERENCES supplier_price_uploads(id) ON DELETE CASCADE,
  supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  question_type   text NOT NULL
                  CHECK (question_type IN (
                    'unknown_subcategory',
                    'unknown_header',
                    'price_anomaly',
                    'duplicate_with_different_price',
                    'unknown_unit',
                    'invalid_price',
                    'invalid_dimension',
                    'unknown_mark_format'
                  )),
  question_text   text NOT NULL,                   -- человекочитаемый вопрос
  context_rows    jsonb NOT NULL,                  -- ±5 строк вокруг аномалии
  affected_offers uuid[] NOT NULL DEFAULT '{}',    -- какие supplier_price_offers ждут ответа
  suggested_answers jsonb,                         -- предложенные кнопки/варианты
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','answered','rejected','expired')),
  answer          jsonb,                           -- ответ менеджера
  answer_creates_rule boolean NOT NULL DEFAULT false,
  created_rule_id uuid REFERENCES supplier_parsing_rules(id) ON DELETE SET NULL,
  answered_by     uuid,
  answered_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_upload
  ON parsing_questions (upload_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_open
  ON parsing_questions (tenant_id, status) WHERE status = 'open';

ALTER TABLE parsing_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS questions_tenant_isolation ON parsing_questions;
CREATE POLICY questions_tenant_isolation ON parsing_questions
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 6. SUPPLIER_SKU_MAPPING — связка supplier_offer ↔ product
-- ────────────────────────────────────────────────────────────────────────────
-- Один offer может маппиться в один product (или ни в один — "новый SKU").
-- Хранится навсегда: если в следующем прайсе тот же canonical_key — мэппинг применяется.

CREATE TABLE IF NOT EXISTS supplier_sku_mapping (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- canonical_key — детерминированный хэш (section, subcategory, mark_normalized, dim_normalized, unit)
  canonical_key       text NOT NULL,
  product_id          uuid,                                 -- nullable! если ещё не смэпплено
  confidence          numeric(4, 3),                        -- 0.000 .. 1.000
  match_method        text
                      CHECK (match_method IS NULL OR match_method IN (
                        'exact_article',
                        'exact_slug',
                        'fuzzy_pg_trgm',
                        'vector_cosine',
                        'manual'
                      )),
  status              text NOT NULL DEFAULT 'auto_proposed'
                      CHECK (status IN (
                        'auto_proposed',  -- предложен авто, ждёт ревью если confidence<0.85
                        'manual_pending', -- ручной маппинг в очереди
                        'confirmed',      -- маппинг утверждён (применяется автоматически)
                        'unmapped',       -- offer без product_id (новый SKU, требует решения)
                        'rejected'        -- маппинг отклонён, не применять
                      )),
  notes               text,
  confirmed_by        uuid,
  confirmed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id, canonical_key)
);

CREATE INDEX IF NOT EXISTS idx_mapping_product
  ON supplier_sku_mapping (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mapping_status
  ON supplier_sku_mapping (tenant_id, status);

ALTER TABLE supplier_sku_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mapping_tenant_isolation ON supplier_sku_mapping;
CREATE POLICY mapping_tenant_isolation ON supplier_sku_mapping
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 7. SUPPLIER_QUOTE_REQUESTS — запрос поставщику от нас
-- ────────────────────────────────────────────────────────────────────────────
-- Когда менеджер в CRM жмёт "Уточнить у поставщика" — создаётся запрос.
-- Канал — email (только email на этом этапе по решению Сергея 2026-04-27).

CREATE TABLE IF NOT EXISTS supplier_quote_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  deal_id             uuid,                                  -- ссылка на сделку/заявку
  contact_id          uuid,                                  -- клиент которому делаем КП
  channel             text NOT NULL DEFAULT 'email'
                      CHECK (channel IN ('email','phone','manual')),
  email_to            text,
  email_message_id    text,                                  -- для match с inbound ответом
  email_sent_at       timestamptz,
  email_subject       text,
  email_body          text,
  items               jsonb NOT NULL,
  -- [{"product_id":"...","sku":"...","name":"...","qty":3.0,"unit":"т"}, ...]
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN (
                        'draft',          -- готовится менеджером
                        'sent',           -- отправлено
                        'answered',       -- получен ответ
                        'partial',        -- ответ только на часть позиций
                        'no_answer',      -- timeout — поставщик не ответил
                        'cancelled'
                      )),
  valid_until         timestamptz,                           -- срок ответа (default +24h)
  reminder_sent_at    timestamptz,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_req_status
  ON supplier_quote_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_req_deal
  ON supplier_quote_requests (deal_id);

ALTER TABLE supplier_quote_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_req_tenant_isolation ON supplier_quote_requests;
CREATE POLICY quote_req_tenant_isolation ON supplier_quote_requests
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 8. SUPPLIER_QUOTE_RESPONSES — ответ поставщика
-- ────────────────────────────────────────────────────────────────────────────
-- Поставщик отвечает email-ом. Менеджер в CRM либо вводит данные руками,
-- либо система парсит email (на следующих этапах) и автозаполняет.
-- ВАЖНО: реальный_вес и реальная_цена ЗЕРКАЛИМ как есть (правило Сергея 2026-04-27).

CREATE TABLE IF NOT EXISTS supplier_quote_responses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  request_id          uuid NOT NULL REFERENCES supplier_quote_requests(id) ON DELETE CASCADE,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  raw_email_body      text,                                  -- если ответ пришёл email-ом
  raw_email_message_id text,
  items               jsonb NOT NULL,
  -- [{"product_id":"...","sku":"...","real_weight_t":3.078,"real_price_per_unit":53990,
  --   "delivery_days":3,"unit":"т","note":"со склада МО"}, ...]
  total_amount        numeric(14, 2),
  delivery_days_max   integer,
  valid_until         timestamptz,
  received_via        text NOT NULL DEFAULT 'manual_entry'
                      CHECK (received_via IN ('manual_entry','email_parser','phone_call')),
  received_by         uuid,
  received_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_resp_request
  ON supplier_quote_responses (request_id);

ALTER TABLE supplier_quote_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_resp_tenant_isolation ON supplier_quote_responses;
CREATE POLICY quote_resp_tenant_isolation ON supplier_quote_responses
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 9. CUSTOMER_PRICE_OVERRIDES — ручные цены под конкретного клиента
-- ────────────────────────────────────────────────────────────────────────────
-- Менеджер в КП может задать цену вручную (per-line) или скидку на КП в целом.
-- Здесь хранятся per-line override-ы. Per-quote скидка хранится в самой quote.

CREATE TABLE IF NOT EXISTS customer_price_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  contact_id      uuid NOT NULL,                          -- клиент
  product_id      uuid NOT NULL,                          -- товар
  deal_id         uuid,                                   -- если override на конкретный КП
  override_price  numeric(14, 2) NOT NULL,
  override_reason text NOT NULL,                          -- ОБЯЗАТЕЛЬНО — обоснование
  created_by      uuid NOT NULL,
  is_below_cost   boolean NOT NULL DEFAULT false,         -- если цена ниже supplier_price
  admin_reviewed  boolean NOT NULL DEFAULT false,
  admin_review_id uuid,                                   -- ссылка на discount_review_queue
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overrides_contact
  ON customer_price_overrides (contact_id, product_id);
CREATE INDEX IF NOT EXISTS idx_overrides_deal
  ON customer_price_overrides (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_overrides_admin_unreviewed
  ON customer_price_overrides (tenant_id) WHERE admin_reviewed = false AND is_below_cost = true;

ALTER TABLE customer_price_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS overrides_tenant_isolation ON customer_price_overrides;
CREATE POLICY overrides_tenant_isolation ON customer_price_overrides
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 10. DISCOUNT_POLICIES — правила скидок
-- ────────────────────────────────────────────────────────────────────────────
-- "VIP клиент = -5%", "новый клиент = 0%", "оптовик > 5т = -3%".
-- Менеджер видит default наценку для клиента, может изменить.
-- Если выходит за рамки правила → запись в discount_review_queue.

CREATE TABLE IF NOT EXISTS discount_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  policy_name     text NOT NULL,
  applies_to      text NOT NULL
                  CHECK (applies_to IN ('all','tier','contact','category','product')),
  applies_to_id   text,                              -- "VIP", contact_id, category_id, product_id
  min_markup_pct  numeric(5, 2) NOT NULL DEFAULT 9.00,
  max_discount_pct numeric(5, 2) NOT NULL DEFAULT 0.00, -- макс. скидка БЕЗ ревью админа
  allow_below_cost boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_active
  ON discount_policies (tenant_id, is_active);

ALTER TABLE discount_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policies_tenant_isolation ON discount_policies;
CREATE POLICY policies_tenant_isolation ON discount_policies
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Дефолтная политика: 9% наценка на всё, 0% макс. скидка без ревью
INSERT INTO discount_policies (
  tenant_id, policy_name, applies_to, min_markup_pct, max_discount_pct
)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Default 9% markup, no auto-discount',
  'all',
  9.00,
  0.00
)
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 11. DISCOUNT_REVIEW_QUEUE — нарушения правил → сигнал админу
-- ────────────────────────────────────────────────────────────────────────────
-- Менеджер ставит цену вне политики → запись здесь + админ получает уведомление.
-- Менеджер обязан написать обоснование (override_reason). Без обоснования — нельзя.

CREATE TABLE IF NOT EXISTS discount_review_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  override_id     uuid REFERENCES customer_price_overrides(id) ON DELETE CASCADE,
  deal_id         uuid,
  contact_id      uuid,
  product_id      uuid,
  manager_id      uuid NOT NULL,
  manager_reason  text NOT NULL,
  policy_id       uuid REFERENCES discount_policies(id) ON DELETE SET NULL,
  policy_breach   text NOT NULL,                          -- "below_cost", "over_max_discount", и т.п.
  proposed_price  numeric(14, 2) NOT NULL,
  supplier_price  numeric(14, 2),
  policy_min_price numeric(14, 2),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','approved','rejected','withdrawn')),
  admin_id        uuid,
  admin_decision  text,
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_review_open
  ON discount_review_queue (tenant_id, status) WHERE status = 'open';

ALTER TABLE discount_review_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS discount_review_tenant_isolation ON discount_review_queue;
CREATE POLICY discount_review_tenant_isolation ON discount_review_queue
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ────────────────────────────────────────────────────────────────────────────
-- 12. РАСШИРЕНИЕ price_items
-- ────────────────────────────────────────────────────────────────────────────
-- Добавляем поля чтобы price_items знал ОТ КОГО эта цена и КАК она получена.

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS source_offer_id uuid REFERENCES supplier_price_offers(id) ON DELETE SET NULL;

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS supplier_price numeric(14, 2);

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS markup_pct numeric(5, 2) NOT NULL DEFAULT 9.00;

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS last_updated_from_supplier_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_price_items_supplier
  ON price_items (supplier_id) WHERE supplier_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 13. РАСШИРЕНИЕ contacts (клиенты)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS customer_tier text NOT NULL DEFAULT 'regular'
    CHECK (customer_tier IN ('regular','vip','wholesale','strategic'));

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS default_discount_pct numeric(5, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS notes_for_pricing text;


-- ────────────────────────────────────────────────────────────────────────────
-- 14. RPC: upsert_supplier_offer
-- ────────────────────────────────────────────────────────────────────────────
-- Идемпотентная вставка из loader-а. Дубликат по (upload_id, source_ref) → UPDATE.

CREATE OR REPLACE FUNCTION upsert_supplier_offer(
  p_tenant_id          uuid,
  p_upload_id          uuid,
  p_supplier_id        uuid,
  p_section            text,
  p_subcategory        text,
  p_mark               text,
  p_dimension_raw      text,
  p_unit               text,
  p_supplier_price     numeric,
  p_source_ref         jsonb,
  p_raw_row            jsonb,
  p_has_anomaly        boolean DEFAULT false,
  p_anomaly_reason     text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_offer_id uuid;
BEGIN
  INSERT INTO supplier_price_offers (
    tenant_id, upload_id, supplier_id, section, subcategory,
    mark, dimension_raw, unit, supplier_price,
    source_ref, raw_row,
    has_anomaly, anomaly_reason,
    status
  )
  VALUES (
    p_tenant_id, p_upload_id, p_supplier_id, p_section, p_subcategory,
    p_mark, p_dimension_raw, p_unit, p_supplier_price,
    p_source_ref, p_raw_row,
    p_has_anomaly, p_anomaly_reason,
    CASE WHEN p_has_anomaly THEN 'pending_review' ELSE 'pending_review' END
  )
  RETURNING id INTO v_offer_id;
  RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────────────────────
-- 15. RPC: create_parsing_question
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_parsing_question(
  p_tenant_id          uuid,
  p_upload_id          uuid,
  p_supplier_id        uuid,
  p_question_type      text,
  p_question_text      text,
  p_context_rows       jsonb,
  p_affected_offers    uuid[],
  p_suggested_answers  jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO parsing_questions (
    tenant_id, upload_id, supplier_id, question_type, question_text,
    context_rows, affected_offers, suggested_answers
  )
  VALUES (
    p_tenant_id, p_upload_id, p_supplier_id, p_question_type, p_question_text,
    p_context_rows, p_affected_offers, p_suggested_answers
  )
  RETURNING id INTO v_id;

  -- инкремент счётчика на upload-е
  UPDATE supplier_price_uploads
    SET questions_total = questions_total + 1,
        questions_open  = questions_open + 1,
        updated_at      = now()
  WHERE id = p_upload_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────────────────────
-- 16. RPC: finalize_upload — после парсинга
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION finalize_supplier_upload(
  p_upload_id uuid
) RETURNS void AS $$
DECLARE
  v_total      integer;
  v_anomalies  integer;
  v_questions  integer;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(CASE WHEN has_anomaly THEN 1 ELSE 0 END), 0)
    INTO v_total, v_anomalies
    FROM supplier_price_offers WHERE upload_id = p_upload_id;

  SELECT COUNT(*) INTO v_questions
    FROM parsing_questions WHERE upload_id = p_upload_id AND status = 'open';

  UPDATE supplier_price_uploads
    SET rows_parsed       = v_total,
        rows_with_anomaly = v_anomalies,
        questions_open    = v_questions,
        status            = CASE
                              WHEN v_questions > 0 THEN 'pending_review'
                              ELSE 'staged'
                            END,
        parsed_at         = now(),
        updated_at        = now()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;

-- ============================================================================
-- ВЕРИФИКАЦИЯ ПОСЛЕ ПРИМЕНЕНИЯ
-- ============================================================================
-- Запустить после `supabase db push`:
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name LIKE 'supplier_%' OR table_name IN
--   ('parsing_questions','customer_price_overrides','discount_policies','discount_review_queue');
-- → должно вернуть 11 строк
--
-- SELECT slug FROM suppliers WHERE tenant_id='a1000000-0000-0000-0000-000000000001';
-- → должно вернуть 'metallservice'
--
-- SELECT policy_name, min_markup_pct FROM discount_policies
--   WHERE tenant_id='a1000000-0000-0000-0000-000000000001';
-- → должно вернуть default 9.00
-- ============================================================================

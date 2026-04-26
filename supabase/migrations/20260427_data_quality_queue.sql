-- ──────────────────────────────────────────────────────────────────────────
-- migration: 20260427_data_quality_queue
-- purpose:   инфраструктура контроля качества данных + очередь ручного ревью
-- author:    Harlan Steel / Week 1
-- ──────────────────────────────────────────────────────────────────────────

-- ─── 1. data_quality_queue: автоматически найденные проблемы ──────────────
CREATE TABLE IF NOT EXISTS data_quality_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  issue_type    text NOT NULL,
                -- 'stale_price'         цена не обновлялась >7 дней
                -- 'missing_price'       у product нет ни одного price_item
                -- 'zero_price'          base_price = 0 или NULL
                -- 'price_mismatch'      разные поставщики дают спред >10%
                -- 'missing_image'       у product нет image_url
                -- 'price_mismatch_at_kp' AI выдал цену не совпадающую с БД
                -- 'missing_price_at_kp'  AI выдал SKU которого нет в БД
  product_id    uuid REFERENCES products(id) ON DELETE CASCADE,
  price_item_id uuid REFERENCES price_items(id) ON DELETE CASCADE,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity      text NOT NULL CHECK (severity IN ('critical','warning','info')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','resolved','snoozed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);

-- Уникальный индекс на открытые issues — для идемпотентного upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_dqq_unique_open
  ON data_quality_queue (tenant_id, issue_type, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(price_item_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_dqq_tenant_status_severity
  ON data_quality_queue (tenant_id, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dqq_product_open
  ON data_quality_queue (product_id) WHERE status = 'open';


-- ─── 2. manual_review_queue: неуверенные fuzzy-маппинги SKU ───────────────
-- Когда supplier sync находит cosine similarity между прайс-строкой и canonical SKU < 0.85
-- → НЕ auto-merge, а ждём подтверждения человека через CRM
CREATE TABLE IF NOT EXISTS manual_review_queue (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL,
  source                 text NOT NULL
                         CHECK (source IN ('supplier_sync','ai_categorization','duplicate_detection')),
  supplier_id            uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  raw_input              jsonb NOT NULL,
  candidates             jsonb NOT NULL DEFAULT '[]'::jsonb,
  best_match_score       numeric,
  ai_suggestion          jsonb,
  status                 text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected','merged','new_sku_created')),
  resolved_product_id    uuid REFERENCES products(id),
  resolved_price_item_id uuid REFERENCES price_items(id),
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at            timestamptz,
  resolved_by            uuid
);

CREATE INDEX IF NOT EXISTS idx_mrq_tenant_status_score
  ON manual_review_queue (tenant_id, status, best_match_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_mrq_supplier
  ON manual_review_queue (supplier_id, status);


-- ─── 3. RLS политики ──────────────────────────────────────────────────────
ALTER TABLE data_quality_queue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_queue  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dqq_tenant_isolation ON data_quality_queue;
CREATE POLICY dqq_tenant_isolation ON data_quality_queue
  USING (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS mrq_tenant_isolation ON manual_review_queue;
CREATE POLICY mrq_tenant_isolation ON manual_review_queue
  USING (tenant_id::text = current_setting('app.tenant_id', true));


-- ─── 4. RPC: идемпотентный upsert проблемы ────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_dq_issue(
  p_tenant_id     uuid,
  p_issue_type    text,
  p_product_id    uuid,
  p_price_item_id uuid,
  p_severity      text,
  p_details       jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO data_quality_queue
    (tenant_id, issue_type, product_id, price_item_id, severity, details, status)
  VALUES
    (p_tenant_id, p_issue_type, p_product_id, p_price_item_id, p_severity, p_details, 'open')
  ON CONFLICT
    ON CONSTRAINT idx_dqq_unique_open  -- по уникальному индексу выше
    DO UPDATE SET
      details = EXCLUDED.details,
      severity = EXCLUDED.severity
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- если ON CONFLICT не сработал из-за условного индекса — fallback на INSERT IF NOT EXISTS
  SELECT id INTO v_id FROM data_quality_queue
  WHERE tenant_id = p_tenant_id
    AND issue_type = p_issue_type
    AND product_id IS NOT DISTINCT FROM p_product_id
    AND price_item_id IS NOT DISTINCT FROM p_price_item_id
    AND status = 'open'
  LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO data_quality_queue
      (tenant_id, issue_type, product_id, price_item_id, severity, details, status)
    VALUES
      (p_tenant_id, p_issue_type, p_product_id, p_price_item_id, p_severity, p_details, 'open')
    RETURNING id INTO v_id;
  ELSE
    UPDATE data_quality_queue SET details = p_details, severity = p_severity WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$$;


-- ─── 5. RPC для аудита: products без price_items ──────────────────────────
CREATE OR REPLACE FUNCTION products_without_prices()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT p.id, p.name
  FROM products p
  WHERE NOT EXISTS (SELECT 1 FROM price_items pi WHERE pi.product_id = p.id);
$$;


-- ─── 6. Комментарии для документации ──────────────────────────────────────
COMMENT ON TABLE  data_quality_queue   IS 'Очередь автоматически детектированных проблем качества данных. Заполняется hourly cron-ом scripts/audit_data_health.ts.';
COMMENT ON TABLE  manual_review_queue  IS 'Очередь неуверенных fuzzy-маппингов при синхронизации прайсов. Ручное подтверждение через CRM.';
COMMENT ON COLUMN data_quality_queue.severity IS 'critical = блокирует продажи; warning = требует внимания; info = к сведению';

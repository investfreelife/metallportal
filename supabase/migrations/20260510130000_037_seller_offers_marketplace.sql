-- ============================================================================
-- Migration: 20260510130000_037_seller_offers_marketplace.sql
-- ТЗ #037 — Marketplace Layer 2: seller_offers (extends/replaces price_items)
-- LAW: knowledge-base/decisions/2026-05-08_LAW-marketplace-architecture.md
--
-- Pattern: Amazon — каждый seller (suppliers row) имеет own offers per product.
-- Frontend Layer 3 рендерит aggregated offers list + Buy Box.
--
-- This migration:
--   1. Создаёт seller_offers table (схожа с price_items + marketplace extensions)
--   2. RLS: sellers see/edit только свои offers через suppliers.user_id == auth.uid()
--   3. Mirror все existing price_items rows → seller_offers
--   4. Helper view: seller_offers_active (для frontend aggregation queries)
-- ============================================================================

BEGIN;

-- 1. Table: seller_offers
CREATE TABLE IF NOT EXISTS seller_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK к canonical product (Layer 1) и seller (Layer 2 = suppliers table)
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Pricing (mirrors price_items для compat)
  base_price NUMERIC(12,2) NOT NULL,
  supplier_price NUMERIC(12,2) NOT NULL,
  final_price NUMERIC(12,2) NOT NULL,
  discount_price NUMERIC(12,2),
  markup_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  unit TEXT,  -- 'т' / 'шт' / 'м' / 'кг'

  -- Stock + ordering
  in_stock BOOLEAN NOT NULL DEFAULT true,
  stock_quantity NUMERIC(12,3),
  min_quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  min_order_qty NUMERIC(10,3),  -- new — distinct от min_quantity (price tier vs order minimum)

  -- Delivery
  lead_time_days INTEGER,        -- new explicit field (was delivery_days)
  regions_served TEXT[],         -- new — array slug-кодов регионов где seller доставляет (Москва, СПб, ...)

  -- Validity window (mirrors price_items)
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Marketplace metadata (new)
  is_active BOOLEAN NOT NULL DEFAULT true,  -- seller can pause без delete
  is_buy_box BOOLEAN NOT NULL DEFAULT false,  -- computed by aggregation logic (winning offer)

  -- Provenance
  source_price_item_id UUID,  -- link к original price_items row для cutover audit trail
  source_offer_id UUID,       -- link к supplier_price_offers raw upload (existing concept)
  last_updated_from_supplier_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints
CREATE INDEX IF NOT EXISTS idx_seller_offers_product ON seller_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_seller_offers_seller ON seller_offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_offers_product_seller ON seller_offers(product_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_offers_active_stock ON seller_offers(is_active, in_stock) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seller_offers_buybox ON seller_offers(product_id) WHERE is_buy_box = true;

COMMENT ON TABLE seller_offers IS 'Marketplace Layer 2: per-seller offers для canonical products. Replaces price_items долгосрочно. Per LAW marketplace-architecture.';
COMMENT ON COLUMN seller_offers.is_buy_box IS 'Winning offer flag. Computed by aggregation: lowest final_price among in_stock active offers. Updated via trigger или batch job.';
COMMENT ON COLUMN seller_offers.regions_served IS 'Array регионов RU где seller доставляет (slugs или ISO codes). NULL = по всей России.';
COMMENT ON COLUMN seller_offers.source_price_item_id IS 'Cutover audit: original price_items.id from которого этот offer был mirror''ed.';

-- 2. Updated_at trigger
CREATE OR REPLACE FUNCTION update_seller_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seller_offers_updated_at ON seller_offers;
CREATE TRIGGER trg_seller_offers_updated_at
  BEFORE UPDATE ON seller_offers
  FOR EACH ROW EXECUTE FUNCTION update_seller_offers_updated_at();

-- 3. RLS policies
ALTER TABLE seller_offers ENABLE ROW LEVEL SECURITY;

-- Public read: anyone may read active in-stock offers (Layer 3 frontend aggregation)
DROP POLICY IF EXISTS "Public read active offers" ON seller_offers;
CREATE POLICY "Public read active offers" ON seller_offers
  FOR SELECT USING (is_active = true);

-- Seller manage own: suppliers.user_id == auth.uid() controls seller_id
DROP POLICY IF EXISTS "Sellers manage own offers" ON seller_offers;
CREATE POLICY "Sellers manage own offers" ON seller_offers
  FOR ALL USING (
    seller_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  ) WITH CHECK (
    seller_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  );

-- Service role bypass (admin / backend)
DROP POLICY IF EXISTS "Service role full access" ON seller_offers;
CREATE POLICY "Service role full access" ON seller_offers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Mirror existing price_items → seller_offers
INSERT INTO seller_offers (
  product_id, seller_id, base_price, supplier_price, final_price, discount_price,
  markup_pct, currency, unit, in_stock, stock_quantity, min_quantity,
  lead_time_days, valid_from, valid_until,
  source_price_item_id, source_offer_id, last_updated_from_supplier_at,
  created_at, updated_at,
  is_active
)
SELECT
  pi.product_id,
  pi.supplier_id,
  pi.base_price,
  pi.supplier_price,
  pi.final_price,
  pi.discount_price,
  pi.markup_pct,
  pi.currency,
  pi.unit,
  pi.in_stock,
  pi.stock_quantity,
  pi.min_quantity,
  pi.delivery_days AS lead_time_days,
  pi.valid_from,
  pi.valid_until,
  pi.id AS source_price_item_id,  -- audit trail
  pi.source_offer_id,
  pi.last_updated_from_supplier_at,
  pi.created_at,
  pi.updated_at,
  true AS is_active
FROM price_items pi
ON CONFLICT DO NOTHING;

-- 5. Buy Box computation: simplest — lowest final_price per product среди active+in_stock
UPDATE seller_offers o
SET is_buy_box = true
FROM (
  SELECT DISTINCT ON (product_id) id
  FROM seller_offers
  WHERE is_active = true AND in_stock = true
  ORDER BY product_id, final_price ASC, created_at ASC  -- tie-break: earliest offer
) winners
WHERE o.id = winners.id;

-- 6. Aggregation view (helper для frontend Layer 3)
CREATE OR REPLACE VIEW seller_offers_aggregated AS
SELECT
  product_id,
  COUNT(*) AS offers_count,
  COUNT(*) FILTER (WHERE in_stock = true) AS offers_in_stock,
  MIN(final_price) FILTER (WHERE is_active = true AND in_stock = true) AS min_price,
  MAX(final_price) FILTER (WHERE is_active = true AND in_stock = true) AS max_price,
  (SELECT seller_id FROM seller_offers o2
   WHERE o2.product_id = o1.product_id AND o2.is_buy_box = true LIMIT 1) AS buy_box_seller_id,
  (SELECT final_price FROM seller_offers o2
   WHERE o2.product_id = o1.product_id AND o2.is_buy_box = true LIMIT 1) AS buy_box_price
FROM seller_offers o1
WHERE is_active = true
GROUP BY product_id;

COMMENT ON VIEW seller_offers_aggregated IS 'Layer 3 frontend aggregation: per-product offers count + price range + buy box selection.';

GRANT SELECT ON seller_offers_aggregated TO anon, authenticated;

COMMIT;

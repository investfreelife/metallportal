-- ============================================================================
-- Migration: 20260505_matcher_columns.sql
-- Phase 0 / Week 2 — шаг 10: колонки matcher для supplier_price_offers
-- ============================================================================

BEGIN;

-- ── 1. Новые колонки в supplier_price_offers ─────────────────────────────
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


-- ── 2. RPC: apply_match_results — батч-запись результатов ────────────────
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


-- ── 3. Расширить manual_review_queue: offer_id, upload_id, reason ────────
-- Существующая таблица из 20260427_data_quality_queue.sql — добавляем поля
-- которые нужны для трассировки с supplier_price_offers.

ALTER TABLE manual_review_queue
  ADD COLUMN IF NOT EXISTS offer_id   uuid REFERENCES supplier_price_offers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS upload_id  uuid REFERENCES supplier_price_uploads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reason     text;

CREATE INDEX IF NOT EXISTS idx_mrq_offer
  ON manual_review_queue (offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mrq_upload
  ON manual_review_queue (upload_id) WHERE upload_id IS NOT NULL;

COMMIT;

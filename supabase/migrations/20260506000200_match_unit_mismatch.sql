-- ══════════════════════════════════════════════════════════════════
-- Migration: add unit_mismatch column to supplier_price_offers
-- Обновить RPC apply_match_results для записи unit_mismatch
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE supplier_price_offers
  ADD COLUMN IF NOT EXISTS unit_mismatch boolean NOT NULL DEFAULT false;

-- Обновляем RPC — теперь пишет unit_mismatch
CREATE OR REPLACE FUNCTION apply_match_results(
  p_upload_id uuid,
  p_results jsonb  -- [{offer_id, product_id|null, status, score, unit_mismatch}]
) RETURNS int AS $$
DECLARE r jsonb; cnt int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    UPDATE supplier_price_offers
       SET matched_product_id = NULLIF((r->>'product_id'),'')::uuid,
           match_status       = r->>'status',
           match_score        = (r->>'score')::numeric,
           unit_mismatch      = COALESCE((r->>'unit_mismatch')::boolean, false),
           matched_at         = now()
     WHERE id = (r->>'offer_id')::uuid;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$ LANGUAGE plpgsql;

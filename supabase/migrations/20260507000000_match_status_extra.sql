-- Расширяем допустимые значения match_status
ALTER TABLE supplier_price_offers
  DROP CONSTRAINT IF EXISTS supplier_price_offers_match_status_check;

ALTER TABLE supplier_price_offers
  ADD CONSTRAINT supplier_price_offers_match_status_check
  CHECK (match_status IN (
    'exact','fuzzy','ambiguous','unmatched',
    'out_of_scope','unmatched_unknown_profile'
  ));

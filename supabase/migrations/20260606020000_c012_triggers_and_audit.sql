-- c012 #3: Triggers (final_price auto-recalc) + supplier_audit_log table.
--
-- 1. Trigger on price_items: auto-compute final_price = supplier_price * (1 + markup_percent/100)
--    fires on INSERT и UPDATE OF (supplier_id, supplier_price).
-- 2. Trigger on suppliers: when markup_percent changes — recalc all related price_items.final_price.
-- 3. supplier_audit_log table — tracks markup changes / bulk apply / soft-delete events.
--
-- Both price-side triggers use the **per-supplier markup_percent** (not legacy
-- per-item markup_pct). Going forward, supplier markup is the canonical source.
-- Legacy markup_pct stays untouched as additional override field for per-line cases.

BEGIN;

-- ── 1. price_items.final_price calc trigger ────────────────────────────
CREATE OR REPLACE FUNCTION public.calc_price_items_final_price()
RETURNS TRIGGER AS $$
DECLARE
  markup NUMERIC(5, 2);
BEGIN
  SELECT markup_percent INTO markup
    FROM public.suppliers
   WHERE id = NEW.supplier_id;

  IF markup IS NULL THEN
    RAISE EXCEPTION 'Supplier % not found', NEW.supplier_id;
  END IF;

  NEW.final_price := ROUND(NEW.supplier_price * (1 + markup / 100), 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_price_items_final_price ON public.price_items;
CREATE TRIGGER trg_price_items_final_price
  BEFORE INSERT OR UPDATE OF supplier_id, supplier_price ON public.price_items
  FOR EACH ROW EXECUTE FUNCTION public.calc_price_items_final_price();

-- ── 2. suppliers.markup_percent → bulk recalc trigger ──────────────────
CREATE OR REPLACE FUNCTION public.recalc_price_items_on_markup_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.markup_percent IS DISTINCT FROM OLD.markup_percent THEN
    UPDATE public.price_items
       SET final_price = ROUND(supplier_price * (1 + NEW.markup_percent / 100), 2),
           updated_at = NOW()
     WHERE supplier_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_markup_recalc ON public.suppliers;
CREATE TRIGGER trg_suppliers_markup_recalc
  AFTER UPDATE OF markup_percent ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.recalc_price_items_on_markup_change();

-- ── 3. supplier_audit_log table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN (
                    'created', 'markup_changed', 'apply_markup_bulk',
                    'soft_deleted', 'reactivated', 'updated'
                  )),
  old_value       JSONB,
  new_value       JSONB,
  affected_rows   INT NOT NULL DEFAULT 0,
  performed_by    UUID,                  -- admin user_id from auth.users
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_audit_supplier_id
  ON public.supplier_audit_log (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_audit_performed_at
  ON public.supplier_audit_log (performed_at DESC);

-- RLS — admin-only read; inserts only via service-role API endpoints
ALTER TABLE public.supplier_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read audit" ON public.supplier_audit_log;
CREATE POLICY "Admin read audit"
  ON public.supplier_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMIT;

-- Post-migration verify:
-- SELECT proname FROM pg_proc
--  WHERE proname IN ('calc_price_items_final_price', 'recalc_price_items_on_markup_change');
-- → 2 rows
--
-- SELECT tgname FROM pg_trigger
--  WHERE tgname IN ('trg_price_items_final_price', 'trg_suppliers_markup_recalc');
-- → 2 rows
--
-- Trigger smoke (test markup recalc):
-- UPDATE suppliers SET markup_percent = 5 WHERE code = 'metallservice';
-- SELECT count(*) FILTER (WHERE final_price = ROUND(supplier_price * 1.05, 2)) FROM price_items
--   WHERE supplier_id = (SELECT id FROM suppliers WHERE code = 'metallservice');
-- → should equal price_items count for that supplier (~11946)
-- UPDATE suppliers SET markup_percent = 0 WHERE code = 'metallservice';  -- reset

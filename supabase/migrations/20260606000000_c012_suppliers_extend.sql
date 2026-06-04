-- c012 #1: Extend existing `suppliers` table with multi-supplier markup fields.
--
-- Existing table (4 rows: МеталлСтрой / УралИнвестМеталл / СибМеталл / МеталлПортал)
-- already has company_name, inn, contact info, etc. We add:
--   - code TEXT UNIQUE       — slug-style identifier ('metallservice', 'metallportal', ...)
--   - markup_percent NUMERIC — per-supplier markup applied к prices
--   - is_active BOOLEAN      — soft-delete flag
--   - contact_info JSONB     — extra structured contact data
--
-- Backfill `code` for existing rows (slugified company_name).
--
-- ТЗ originally proposed brand-new `suppliers` table with these fields.
-- Adapted к existing schema — additive, no destructive changes (lesson 075).

BEGIN;

-- 1. Add new columns (idempotent, NOT NULL with defaults)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (markup_percent >= 0 AND markup_percent <= 100),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contact_info JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill `code` for existing rows that don't have it.
--    Use deterministic slugs based on canonical names.
UPDATE public.suppliers
   SET code = CASE
                 WHEN company_name = 'МеталлСтрой'        THEN 'metallservice'
                 WHEN company_name = 'УралИнвестМеталл'   THEN 'uralinvest'
                 WHEN company_name = 'СибМеталл'          THEN 'sibmetal'
                 WHEN company_name = 'МеталлПортал'       THEN 'metallportal'
                 ELSE LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]+', '_', 'g'))
              END
 WHERE code IS NULL;

-- 3. NOT NULL + UNIQUE on `code` (after backfill)
ALTER TABLE public.suppliers
  ALTER COLUMN code SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_code_key' AND conrelid = 'public.suppliers'::regclass
  ) THEN
    ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_code_key UNIQUE (code);
  END IF;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers (code);

-- 5. updated_at auto-update trigger (idempotent re-create)
CREATE OR REPLACE FUNCTION public.update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_suppliers_updated_at();

COMMIT;

-- Post-migration verify:
-- SELECT code, company_name, markup_percent, is_active FROM suppliers ORDER BY code;
-- → 4 rows: metallservice (МеталлСтрой), metallportal (МеталлПортал),
--   sibmetal (СибМеталл), uralinvest (УралИнвестМеталл) — all is_active=true, markup_percent=0

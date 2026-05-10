-- ============================================================================
-- Migration: 20260510190000_044_seller_applications.sql
-- ТЗ #044 — Self-service supplier onboarding с KYC + admin approval queue
--
-- Flow:
--   1. User signs up → submits multi-step form → INSERT seller_applications с status='pending'
--   2. Admin sees queue → reviews ИНН/ОГРН/документы → approves/rejects
--   3. On approval → INSERT suppliers row + UPDATE application с seller_id linked
--   4. Approved seller logs in → redirects к /supplier/dashboard (#039)
--
-- Auth model:
--   - User can read/insert own application (по auth.uid() == user_id)
--   - Admin role can read all + update status
--   - Service role bypass для backend approval logic
-- ============================================================================

BEGIN;

-- 1. Enum для status (cleaner than text constraint)
DO $$ BEGIN
  CREATE TYPE seller_application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table: seller_applications
CREATE TABLE IF NOT EXISTS seller_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth link
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Company identity (KYC core fields)
  company_name TEXT NOT NULL,
  inn TEXT NOT NULL,                    -- 10 digits OOO / 12 digits ИП
  ogrn TEXT,                            -- 13 digits OOO / 15 digits ИП
  legal_form TEXT,                      -- 'OOO' | 'IP' | 'AO' | 'PAO' | 'other'
  legal_address TEXT,
  bank_account TEXT,                    -- account number (no BIK separation для MVP)
  bank_name TEXT,
  bik TEXT,                             -- 9-digit БИК

  -- Contacts
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT NOT NULL,

  -- Marketplace metadata
  regions_served TEXT[],                -- e.g. ['MO','SPB','77','78']
  product_categories_planned TEXT[],    -- L1 slugs they want to sell в

  -- Documents (uploaded к storage bucket via signed URL flow)
  documents_url TEXT,                   -- ссылка на uploaded ZIP/PDF
  documents_metadata JSONB DEFAULT '[]'::jsonb,  -- [{name, size, mimetype, uploaded_at}]

  -- Workflow
  status seller_application_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,

  -- Approval audit trail
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  seller_id UUID REFERENCES suppliers(id),  -- populated при approval

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One pending application per user (prevent dups)
  CONSTRAINT seller_applications_user_unique_pending
    UNIQUE NULLS NOT DISTINCT (user_id, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON seller_applications(status);
CREATE INDEX IF NOT EXISTS idx_seller_applications_user ON seller_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_applications_created ON seller_applications(created_at DESC);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION update_seller_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seller_applications_updated_at ON seller_applications;
CREATE TRIGGER trg_seller_applications_updated_at
  BEFORE UPDATE ON seller_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_applications_updated_at();

-- 4. RLS
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;

-- 4a. Users can read own application
DROP POLICY IF EXISTS "Users read own application" ON seller_applications;
CREATE POLICY "Users read own application"
  ON seller_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4b. Users can insert own application
DROP POLICY IF EXISTS "Users insert own application" ON seller_applications;
CREATE POLICY "Users insert own application"
  ON seller_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4c. Admin role reads all + updates status
-- Использует profiles.role == 'admin' (см. existing admin auth pattern)
DROP POLICY IF EXISTS "Admins read all applications" ON seller_applications;
CREATE POLICY "Admins read all applications"
  ON seller_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins update applications" ON seller_applications;
CREATE POLICY "Admins update applications"
  ON seller_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 4d. Service role bypass (для backend approval logic)
DROP POLICY IF EXISTS "Service role full access" ON seller_applications;
CREATE POLICY "Service role full access"
  ON seller_applications FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 5. Helper view — admin queue (joined с auth.users email + count of docs)
CREATE OR REPLACE VIEW seller_applications_admin AS
SELECT
  sa.*,
  u.email AS user_email,
  COALESCE(jsonb_array_length(sa.documents_metadata), 0) AS documents_count
FROM seller_applications sa
LEFT JOIN auth.users u ON u.id = sa.user_id;

GRANT SELECT ON seller_applications_admin TO authenticated, service_role;

COMMIT;

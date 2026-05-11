-- ============================================================================
-- Migration: 20260511180000_049_referral_v2_three_levels.sql
-- ТЗ #049 — Referral program v2: 3-level MLM с lifetime 1% скидкой
--
-- Replaces бронза/серебро/золото single-tier model on:
--   L1 (прямой реферал) → 0.5% от заказа
--   L2 (на 2 уровня) → 0.25%
--   L3 (на 3 уровня) → 0.25%
--   Покупатель (зарегистрирован по реф ссылке) → 1% lifetime скидка
--
-- Защита:
--   - Min order: 3 тонны металла для активации payout (check в backend)
--   - Cooling period: 30 дней от заказа до payout (earnable_at)
--   - Возврат заказа → cancel transaction (status='cancelled')
--   - KYC при выводе (kyc_verified flag)
--   - 1 человек = 1 аккаунт (проверка по phone_normalized + email duplicates)
--   - Cap: НЕТ (Sergey: «без cap на старте»)
-- ============================================================================

BEGIN;

-- 1. site_users extensions
ALTER TABLE site_users
  ADD COLUMN IF NOT EXISTS referral_card BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE site_users
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;
ALTER TABLE site_users
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_site_users_referred_by ON site_users(referred_by);
CREATE INDEX IF NOT EXISTS idx_site_users_ref_code ON site_users(ref_code) WHERE ref_code IS NOT NULL;

-- 2. Site referral transactions table (cascade payouts по 3 уровням)
CREATE TABLE IF NOT EXISTS site_referral_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  earner_user_id UUID NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES site_users(id),
  order_id UUID,
  order_amount NUMERIC(12,2) NOT NULL,
  order_weight_kg NUMERIC(12,2),
  level INT NOT NULL CHECK (level IN (1,2,3)),
  commission_rate NUMERIC(6,5) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','paid','cancelled')),
  earnable_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  paid_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srt_earner ON site_referral_transactions(earner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_srt_buyer ON site_referral_transactions(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_srt_earnable ON site_referral_transactions(earnable_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_srt_order ON site_referral_transactions(order_id);

CREATE OR REPLACE FUNCTION update_srt_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_srt_updated_at ON site_referral_transactions;
CREATE TRIGGER trg_srt_updated_at BEFORE UPDATE ON site_referral_transactions
  FOR EACH ROW EXECUTE FUNCTION update_srt_updated_at();

ALTER TABLE site_referral_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role srt full" ON site_referral_transactions;
CREATE POLICY "Service role srt full"
  ON site_referral_transactions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

COMMIT;

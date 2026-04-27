-- ============================================================================
-- Migration: 20260504_2_supplier_uploads_align.sql
-- Phase 0 / Week 2 — дотягиваем supplier_price_uploads до схемы v2
-- ============================================================================
-- ПРИЧИНА: supplier_price_uploads уже существовала в БД. CREATE TABLE IF NOT EXISTS
-- в 20260504_supplier_pricing_v2.sql пропустил создание. RPC-функции
-- create_parsing_question и finalize_supplier_upload обращаются к updated_at
-- которой нет. Добавляем колонку + автотриггер.
-- ============================================================================

BEGIN;

-- ── 1. Добавить updated_at (единственная недостающая колонка) ─────────────
ALTER TABLE supplier_price_uploads
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── 2. Триггер автообновления updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_price_uploads_updated_at ON supplier_price_uploads;
CREATE TRIGGER trg_supplier_price_uploads_updated_at
  BEFORE UPDATE ON supplier_price_uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

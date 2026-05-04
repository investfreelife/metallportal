-- W2-22: Профнастил — активация существующего L2/L3 + создание L3 nerzhaveyuschiy.
--
-- Per ТЗ #i002 (catalog-images agent, approve по REPORT i001).
--
-- Состояние ДО миграции (verified via Management API 2026-05-04):
--   Под Металлопрокат L1 (431b32e6-...):
--     L2 profnastil          (33147480-..., sort=12, is_active=false, cnt=0)  ← АКТИВИРОВАТЬ
--     L3 profnastil-okrashennyy   (117e1a2d-..., sort=2, is_active=false, cnt=0)  ← АКТИВИРОВАТЬ
--     L3 profnastil-otsinkovannyy (61f53f73-..., sort=3, is_active=false, cnt=0)  ← АКТИВИРОВАТЬ
--   Под Листовой прокат L1 (e61f1615-...):
--     L2 profnastil-proflist (7d516995-..., sort=6,  is_active=true, cnt=0)   ← SOFT-DEACTIVATE
--     L2 prof-okrash         (6e80f5ee-..., sort=0,  is_active=false, cnt=0)  ← already false
--     L2 prof-ocink          (a81a64bf-..., sort=0,  is_active=false, cnt=0)  ← already false
--
-- Действия миграции:
--   1. ACTIVATE existing profnastil L2 + 2 L3 (okrash, otsink) — выбрана canonical structure под Металлопрокат
--   2. CREATE NEW L3 profnastil-nerzhaveyuschiy (sort=4) — для 12 нержавеющих SKU из source
--   3. SOFT-DEACTIVATE profnastil-proflist (4 параллельный empty slot, не удаляем — lesson 075)
--
-- POLICY-compliance:
--   - Не DROP / DELETE категорий (lesson 075 — canonical baseline, no destructive mutations).
--   - Soft-deactivate через is_active=false (lesson 080 — pre-allocated slots могут быть восстановлены через future ТЗ).
--   - Все другие L1/L2/L3 — не trogаем.

DO $$
DECLARE
  v_profnastil_l2_id uuid := '33147480-87db-408a-a086-d9bca117133a';
  v_okrash_l3_id     uuid := '117e1a2d-7fab-4961-90a5-e098ca642233';
  v_otsink_l3_id     uuid := '61f53f73-2535-4d3e-963b-657ec34195df';
  v_proflist_l2_id   uuid := '7d516995-a01e-4bb7-bbce-4ccdd69d2789';
BEGIN
  -- 1. Activate canonical L2 + 2 L3 (verified empty before migration).
  UPDATE categories SET is_active = true
  WHERE id = v_profnastil_l2_id AND is_active = false;

  UPDATE categories SET is_active = true
  WHERE id = v_okrash_l3_id AND is_active = false;

  UPDATE categories SET is_active = true
  WHERE id = v_otsink_l3_id AND is_active = false;

  -- 2. Create new L3 profnastil-nerzhaveyuschiy under existing profnastil L2.
  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES ('profnastil-nerzhaveyuschiy', 'Профнастил нержавеющий', v_profnastil_l2_id, 4, true)
  ON CONFLICT (slug) DO NOTHING;

  -- 3. Soft-deactivate parallel empty slot under listovoy-prokat (lesson 075/080: keep, do not DROP).
  UPDATE categories SET is_active = false
  WHERE id = v_proflist_l2_id AND is_active = true;

  -- prof-okrash (6e80f5ee-...) и prof-ocink (a81a64bf-...) — уже is_active=false, миграция no-op для них.
END $$;

COMMENT ON TABLE categories IS 'W2-22: profnastil canonical L2 + 3 L3 (okrash/otsink/nerz) активированы; profnastil-proflist soft-deactivated.';

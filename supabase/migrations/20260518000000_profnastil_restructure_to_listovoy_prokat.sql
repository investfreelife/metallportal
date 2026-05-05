-- W2-22 RESTRUCTURE (i006): Профнастил MOVE из дублирующего L1 metalloprokat
-- в canonical structure listovoy-prokat → profnastil-proflist L2 → 3 L3.
--
-- Контекст (lesson 091):
--   W2-22 #i002 разместил 935 SKU в новом L1 'metalloprokat' / L2 'profnastil' / 3 L3.
--   Это было ошибочное approve coordinator'а — должно было быть под существующим
--   'listovoy-prokat' L1 / 'profnastil-proflist' L2 (lesson 080 — pre-allocated empty slot).
--
-- Pre-state (verified 2026-05-04 23:40 via Management API):
--   listovoy-prokat       L1 [active,  sort=70, 0 products]
--     profnastil-proflist L2 [INACTIVE, sort=6,  0 products]  ← target slot, активировать
--     prof-okrash         L2 [inactive, sort=0,  0 products]  ← parallel slot, оставить как есть
--     prof-ocink          L2 [inactive, sort=0,  0 products]  ← parallel slot, оставить как есть
--
--   metalloprokat         L1 [active,  sort=1, 0 products]    ← soft-deactivate (legacy duplicate)
--     profnastil          L2 [active,  sort=12, 0 products]   ← soft-deactivate (legacy duplicate)
--       profnastil-okrashennyy     L3 [active, sort=2, 765 products] ← MOVE
--       profnastil-otsinkovannyy   L3 [active, sort=3, 158 products] ← MOVE
--       profnastil-nerzhaveyuschiy L3 [active, sort=4,  12 products] ← MOVE
--
-- Post-state (target):
--   listovoy-prokat (L1, active)
--     profnastil-proflist (L2, active)
--       profnastil-okrashennyy     L3 [active, 765 products]
--       profnastil-otsinkovannyy   L3 [active, 158 products]
--       profnastil-nerzhaveyuschiy L3 [active,  12 products]
--   metalloprokat L1, profnastil L2 → both is_active=false (lesson 075: NO DROP).
--
-- POLICY-compliance:
--   - Не DROP / DELETE категорий (lesson 075).
--   - Soft-deactivate legacy duplicate L1+L2 — keep as historical record.
--   - 935 products НЕ перемещаются (категория-владелец это L3, parent_id L3 меняется).
--   - Slugs L3 не меняются → product URLs остаются валидными вне зависимости от path.

DO $$
DECLARE
  v_listovoy_id   uuid;
  v_proflist_id   uuid;
  v_metalloprokat_id uuid := '431b32e6-00f7-4954-9516-cfd6b320163a';
  v_profnastil_l2_id uuid := '33147480-87db-408a-a086-d9bca117133a';
BEGIN
  SELECT id INTO v_listovoy_id FROM categories WHERE slug = 'listovoy-prokat';
  IF v_listovoy_id IS NULL THEN
    RAISE EXCEPTION 'Parent listovoy-prokat L1 not found';
  END IF;

  SELECT id INTO v_proflist_id FROM categories WHERE slug = 'profnastil-proflist';
  IF v_proflist_id IS NULL THEN
    RAISE EXCEPTION 'Target profnastil-proflist L2 not found';
  END IF;

  -- Step 1: Активация ancestor (listovoy-prokat L1) — idempotent (lesson 090)
  UPDATE categories SET is_active = true
  WHERE id = v_listovoy_id AND is_active = false;

  -- Step 2: Активация target L2 profnastil-proflist
  UPDATE categories SET is_active = true
  WHERE id = v_proflist_id AND is_active = false;

  -- Step 3: MOVE 3 L3 categories под profnastil-proflist
  UPDATE categories
  SET parent_id = v_proflist_id
  WHERE slug IN ('profnastil-okrashennyy', 'profnastil-otsinkovannyy', 'profnastil-nerzhaveyuschiy');

  -- Step 4: Soft-deactivate legacy L2 profnastil (под metalloprokat) — теперь orphan
  UPDATE categories SET is_active = false
  WHERE id = v_profnastil_l2_id;

  -- Step 5: Soft-deactivate legacy L1 metalloprokat (не в canonical structure)
  UPDATE categories SET is_active = false
  WHERE id = v_metalloprokat_id;
END $$;

COMMENT ON TABLE categories IS 'W2-22 RESTRUCTURE: profnastil moved listovoy-prokat → profnastil-proflist; metalloprokat L1 + profnastil L2 (legacy дубликат) deactivated.';

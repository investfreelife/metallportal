-- W2-24: создание L2 list-iznosostoykiy под существующей L1
-- iznosostoykaya-vysokoprochnaya-stal-gadfilda + ancestor chain activation.
--
-- Per ТЗ #016 (approve all 6 questions REPORT #015 = recommended).
--
-- Сергей предусмотрел `iznosostoykaya-vysokoprochnaya-stal-gadfilda` L1
-- (sort=100, parent=null) как pre-allocated empty slot для износостойких
-- сталей. Аналог mostovaya-stal (W2-18) / dupleksnaya-stal (W2-19).
--
-- Initial seed: ~60 SKU из мульти-источника Листы стальные г/к (W2-24).
-- Содержит NM 500 / NM 450 / Mn13 (Hadfield) / BS700MCK4 / Q690E (HSLA).
--
-- L1 → L2-with-products pattern (depth=2).
--
-- Lesson 090: ancestor chain activation для предотвращения профнастил-bug
-- (продукты seeded, но navigation broken т.к. parent inactive).

-- Step 1: Activate ancestors (idempotent — no-op если уже active).
UPDATE categories SET is_active = true
WHERE slug IN (
  'iznosostoykaya-vysokoprochnaya-stal-gadfilda',
  'listovoy-prokat',
  'nerzhaveyuschaya-stal',
  'kachestvennye-stali'
)
AND is_active = false;

-- Step 2: Activate существующие L2 целевые categories.
UPDATE categories SET is_active = true
WHERE slug IN (
  'list-g-k',
  'list-nerzhaveyuschiy',
  'list-g-k-normalnoy-prochnosti',
  'list-g-k-povyshennoy-prochnosti'
)
AND is_active = false;

-- Step 3: Insert new L2 list-iznosostoykiy.
DO $$
DECLARE
  v_iznos_id uuid;
BEGIN
  SELECT id INTO v_iznos_id FROM categories
   WHERE slug = 'iznosostoykaya-vysokoprochnaya-stal-gadfilda';
  IF v_iznos_id IS NULL THEN
    RAISE EXCEPTION 'Parent category iznosostoykaya-vysokoprochnaya-stal-gadfilda (L1) not found';
  END IF;

  INSERT INTO categories (slug, name, parent_id, sort_order, is_active)
  VALUES ('list-iznosostoykiy', 'Лист износостойкий', v_iznos_id, 1, true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true;
END $$;

COMMENT ON TABLE categories IS 'W2-24: list-iznosostoykiy L2 added under iznosostoykaya-vysokoprochnaya-stal-gadfilda L1 + ancestor chain activation per lesson 090.';

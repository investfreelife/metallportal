-- c025 P0 URGENT: catalog structure lock + product_categories junction.
--
-- Per LAW-catalog-structure-lock (knowledge-base/decisions/2026-05-06_*.md):
-- 1. `display_section` enum splits catalog в 2 sections — /catalog (металлопрокат)
--    vs /constructions (готовые изделия типа Навесы, Гаражи, Заборы, etc).
-- 2. `product_categories` junction enables cross-listing — product может
--    жить в нескольких categories simultaneously (Sergey: «профнастил
--    должен быть в Листовом И в Кровельных одновременно»).
-- 3. `get_product_counts()` RPC updated to use junction (DISTINCT product_id).
--
-- IMPORTANT: enum value `'metallоprokat'` имеет Cyrillic `о` (U+043E)
-- между `metall` и `prokat`. Спец LAW так задаёт; preserved as-is для
-- consistency. Mixed Cyrillic/Latin in same identifier is unusual but
-- canonical — не "fix" к Latin без Sergey explicit approval.

BEGIN;

-- ── Part A: display_section column ─────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS display_section TEXT NOT NULL DEFAULT 'metallоprokat'
  CHECK (display_section IN ('metallоprokat', 'constructions'));

CREATE INDEX IF NOT EXISTS idx_categories_display_section
  ON public.categories (display_section, is_active);

-- Move «Готовые конструкции» subtree → constructions section
WITH RECURSIVE descendants AS (
  SELECT id FROM public.categories
   WHERE slug = 'gotovye-konstruktsii' AND parent_id IS NULL
  UNION ALL
  SELECT c.id FROM public.categories c
    JOIN descendants d ON c.parent_id = d.id
)
UPDATE public.categories
   SET display_section = 'constructions'
 WHERE id IN (SELECT id FROM descendants);

-- ── Part B: product_categories junction ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product
  ON public.product_categories (product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category
  ON public.product_categories (category_id);

-- One primary category per product (enforced by partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_categories_primary
  ON public.product_categories (product_id)
  WHERE is_primary = true;

-- Backfill: copy products.category_id → product_categories с is_primary=true
INSERT INTO public.product_categories (product_id, category_id, is_primary)
SELECT id, category_id, true
  FROM public.products
 WHERE category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Public read RLS — junction is content data
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_categories" ON public.product_categories;
CREATE POLICY "Public read product_categories"
  ON public.product_categories
  FOR SELECT
  USING (true);

-- ── Part C: get_product_counts() — use junction with DISTINCT ──────────
-- Existing version (20260526120000) counts через products.category_id
-- direct. Updated version uses junction — cross-listed products counted
-- once per category subtree (DISTINCT product_id).
CREATE OR REPLACE FUNCTION public.get_product_counts()
RETURNS TABLE(category_id UUID, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE descendants AS (
    SELECT c.id AS category_id, c.id AS descendant_id
    FROM public.categories c
    WHERE c.is_active = true
    UNION ALL
    SELECT d.category_id, c.id
    FROM public.categories c
    JOIN descendants d ON c.parent_id = d.descendant_id
    WHERE c.is_active = true
  )
  SELECT d.category_id, COUNT(DISTINCT pc.product_id)::bigint AS count
  FROM descendants d
  LEFT JOIN public.product_categories pc ON pc.category_id = d.descendant_id
  LEFT JOIN public.products p
    ON p.id = pc.product_id AND p.is_active = true
  GROUP BY d.category_id;
$$;

COMMIT;

-- Post-migration verify:
-- SELECT display_section, count(*) FROM categories GROUP BY 1;
--   → 'metallоprokat' ~115 rows, 'constructions' ~11 rows
-- SELECT count(*) FROM product_categories;            → 7390
-- SELECT count(*) FROM product_categories WHERE is_primary;  → 7390
-- SELECT * FROM get_product_counts() WHERE category_id IN (
--   SELECT id FROM categories WHERE slug='gotovye-konstruktsii'
-- );

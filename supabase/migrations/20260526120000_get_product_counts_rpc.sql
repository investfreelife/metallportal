-- m002.5 Block 3: восстановление get_product_counts() RPC.
--
-- Контекст: lib/queries.ts:117 вызывает supabase.rpc('get_product_counts')
-- но функция отсутствовала в существующих migrations (regression — была
-- удалена случайно или никогда не комm'итилась после initial seed).
-- В production category counts отображаются 0 везде, навигация-сайдбар
-- бесполезна.
--
-- Recursive CTE: для каждой category возвращает count active products
-- во всех её descendants (дети, внуки, ...). Стандарт для navigation
-- tree — top-level "Сортовой прокат" должна показывать сумму всех
-- products under sortovoy-prokat/<любой leaf>.

CREATE OR REPLACE FUNCTION get_product_counts()
RETURNS TABLE(category_id uuid, count bigint)
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE descendants AS (
    -- Anchor: каждая категория сама себе descendant (для leaf categories).
    SELECT c.id AS category_id, c.id AS descendant_id
    FROM categories c
    WHERE c.is_active = true

    UNION ALL

    -- Recursion: дети любой категории — её descendants.
    SELECT d.category_id, c.id
    FROM categories c
    JOIN descendants d ON c.parent_id = d.descendant_id
    WHERE c.is_active = true
  )
  SELECT d.category_id, COUNT(p.id)::bigint AS count
  FROM descendants d
  LEFT JOIN products p
    ON p.category_id = d.descendant_id
   AND p.is_active = true
  GROUP BY d.category_id;
$$;

-- Verify (manual):
--   SELECT category_id, count FROM get_product_counts() ORDER BY count DESC LIMIT 20;
-- Expected: top-level categories (sortovoy-prokat, listovoy-prokat) — > 1000.

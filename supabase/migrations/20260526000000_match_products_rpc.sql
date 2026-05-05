-- W2-26 #c007: cosine-similarity RPC over products.embedding
--
-- Used by /api/catalog/rag-search — input: 1536-dim embedding, output:
-- top-N matched products with similarity, dimensions, prices.
--
-- NOTE on `dimensions` cast: Block 2 of #c006 rolled back, column is `text`.
-- Block 1 of #c006 + existing seed pipelines store JSON-formatted strings,
-- so `::jsonb` cast is valid for all rows. When #c008 retries the type
-- change to jsonb (after Никита's m002.5 frontend fix), this RPC keeps
-- working without modification (jsonb→jsonb is no-op).
--
-- Threshold and count are parametrized; defaults match ТЗ c007.

CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count    int   DEFAULT 10
)
RETURNS TABLE (
  id            uuid,
  slug          text,
  name          text,
  category_slug text,
  similarity    float,
  dimensions    jsonb,
  image_url     text,
  prices        jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.slug,
    p.name,
    c.slug AS category_slug,
    1 - (p.embedding <=> query_embedding) AS similarity,
    CASE
      WHEN p.dimensions IS NULL OR p.dimensions = '' THEN NULL
      ELSE p.dimensions::jsonb
    END AS dimensions,
    p.image_url,
    (
      SELECT jsonb_agg(jsonb_build_object(
               'unit',     pi.unit,
               'base',     pi.base_price,
               'discount', pi.discount_price
             ) ORDER BY pi.base_price)
        FROM price_items pi
       WHERE pi.product_id = p.id
    ) AS prices
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.is_active = true
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Verify:
-- SELECT proname FROM pg_proc WHERE proname = 'match_products';  -- 1 row
-- (functional test only after embeddings generated в #c007 script run)

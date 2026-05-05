-- W2-26 #c006 Block 3: pgvector infrastructure for AI obzvon RAG
--
-- Adds (no embeddings generated here — that's #c007):
--   1. pgvector extension (CREATE EXTENSION IF NOT EXISTS vector)
--   2. products.embedding vector(1536) column (OpenAI text-embedding-3-small dim)
--   3. ivfflat index for cosine similarity search
--      (lists=100 — appropriate for current 4500 SKU; раскрутить позже до
--       sqrt(N) ≈ 200 lists when product count crosses 40K)
--   4. products_embedding_jobs tracking table — для orchestration backfill jobs
--      (status: pending / processing / done / failed; kept thin — embeddings
--       themselves live on `products.embedding`).
--
-- Embedding generation pipeline = future #c007 (catalog-writer task with
-- OpenAI API key + batched fetch).

BEGIN;

-- 1. Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embedding column
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. ivfflat cosine index (best for "find similar" queries)
CREATE INDEX IF NOT EXISTS idx_products_embedding_cosine
  ON products USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Jobs tracking (orchestration metadata — embeddings_value stays on products)
CREATE TABLE IF NOT EXISTS products_embedding_jobs (
  id              SERIAL PRIMARY KEY,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error           text,
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  source_text     text,                 -- snapshot of input passed to model
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  generated_at    timestamptz,
  UNIQUE (product_id, embedding_model)  -- 1 job per (product, model)
);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status
  ON products_embedding_jobs (status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_product
  ON products_embedding_jobs (product_id);

COMMIT;

-- Post-migration verify:
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='products' AND column_name='embedding';
-- SELECT indexname FROM pg_indexes WHERE indexname='idx_products_embedding_cosine';
-- SELECT count(*) FROM products_embedding_jobs;  -- 0 (table empty until #c007)

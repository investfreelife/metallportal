import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase'
import { ragSearchRatelimit, getClientIp } from '@/lib/ratelimit'

/**
 * POST /api/catalog/rag-search — semantic search над products.embedding (#c007).
 *
 * Body: { query: string; threshold?: number; limit?: number }
 *
 * Pipeline:
 *   1. OpenAI text-embedding-3-small → 1536-dim vector for query string
 *   2. Supabase RPC `match_products` → cosine similarity (uses ivfflat index)
 *   3. Returns top-N matches with similarity score, dimensions, prices
 *
 * Used by: future AI обзвон (Phase 2 CRM) RAG over our catalog.
 *
 * Cost: ~$0.00002 per query (1 short input embedding via text-embedding-3-small).
 *
 * Errors:
 *   400 — query missing / too long (> 2000 chars)
 *   401 — no OPENAI_API_KEY env
 *   429 — rate-limited (per-IP, 30 req/min/IP — semantic search is somewhat costly)
 *   502 — OpenAI API failure
 */

const MAX_QUERY_CHARS = 2000
const DEFAULT_THRESHOLD = 0.5
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

type RagMatch = {
  id: string
  slug: string
  name: string
  category_slug: string | null
  similarity: number
  dimensions: Record<string, unknown> | null
  image_url: string | null
  prices: Array<{ unit: string | null; base: number; discount: number | null }> | null
}

export async function POST(req: NextRequest) {
  // Public endpoint — semantic search is not authenticated, but rate-limited
  // per-IP since it triggers OpenAI calls.
  const ip = getClientIp(req)
  const { success } = await ragSearchRatelimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  let body: { query?: unknown; threshold?: unknown; limit?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const queryRaw = body.query
  if (typeof queryRaw !== 'string' || queryRaw.trim().length === 0) {
    return NextResponse.json({ error: 'query (string) is required' }, { status: 400 })
  }
  const query = queryRaw.trim().slice(0, MAX_QUERY_CHARS)

  const threshold =
    typeof body.threshold === 'number' &&
    body.threshold >= 0 &&
    body.threshold <= 1
      ? body.threshold
      : DEFAULT_THRESHOLD

  const limit =
    typeof body.limit === 'number' && body.limit > 0
      ? Math.min(Math.floor(body.limit), MAX_LIMIT)
      : DEFAULT_LIMIT

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 401 })
  }

  // 1. Embed query
  // Project routes API calls through OpenRouter (`OPENAI_API_BASE` env);
  // OpenAI native works too if base is unset and key is `sk-...`.
  const openai = new OpenAI({
    apiKey: openaiKey,
    ...(process.env.OPENAI_API_BASE
      ? { baseURL: process.env.OPENAI_API_BASE }
      : {}),
  })
  const isOpenRouter =
    (process.env.OPENAI_API_BASE ?? '').includes('openrouter.ai') ||
    openaiKey.startsWith('sk-or-')
  const embeddingModel = isOpenRouter
    ? 'openai/text-embedding-3-small'
    : 'text-embedding-3-small'

  let queryEmbedding: number[]
  try {
    const res = await openai.embeddings.create({
      model: embeddingModel,
      input: query,
    })
    queryEmbedding = res.data[0]?.embedding ?? []
    if (queryEmbedding.length === 0) {
      return NextResponse.json({ error: 'OpenAI returned empty embedding' }, { status: 502 })
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'OpenAI embedding failed', detail: (e as Error).message },
      { status: 502 },
    )
  }

  // 2. Cosine similarity search via RPC.
  // `match_products` is created by migration 20260526000000 (#c007); regenerate
  // `lib/database.types.ts` to surface its signature in Supabase typings — until
  // then we cast through unknown to bypass the strict Database['public']['Functions'].
  const supabase = createAdminClient() as unknown as {
    rpc: (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
  }
  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: queryEmbedding as unknown as string,
    match_threshold: threshold,
    match_count: limit,
  })
  if (error) {
    return NextResponse.json(
      { error: 'match_products RPC failed', detail: error.message },
      { status: 500 },
    )
  }

  const matches: RagMatch[] = ((data as RagMatch[] | null) ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category_slug: r.category_slug,
    similarity: r.similarity,
    dimensions: r.dimensions,
    image_url: r.image_url,
    prices: r.prices,
  }))

  return NextResponse.json({
    matches,
    meta: { query, threshold, limit, count: matches.length },
  })
}

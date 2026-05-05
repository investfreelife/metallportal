/**
 * /api/cron/embedding-backfill
 *
 * Vercel Cron entry: every 6 hours (cron expression `0 *_6 * * *`,
 * see vercel.json — actual asterisk-slash literal escaped here so JSDoc
 * doesn't terminate the comment block).
 * Picks up products that lack `embedding` and generates them — covers
 * SKUs that были seeded после the last manual run of
 * `scripts/generate_product_embeddings.ts` (#c007 baseline).
 *
 * Pipeline:
 *   1. SELECT 500 active products WHERE embedding IS NULL
 *   2. Compose input text = name | grade | dimensions | category
 *   3. Embed batch via OpenRouter `openai/text-embedding-3-small`
 *   4. UPDATE products.embedding for each SKU
 *   5. INSERT job rows into `products_embedding_jobs` (audit log)
 *
 * Auth: `X-Cron-Secret: $CRON_SECRET` header (Vercel Cron uses this
 * via `Authorization: Bearer …` — both accepted, mirroring
 * `audit-data-health` cron pattern).
 *
 * Manual probe:
 *   curl -H "X-Cron-Secret: $CRON_SECRET" https://www.harlansteel.ru/api/cron/embedding-backfill
 *
 * Limits:
 *   - 500 SKU per run = 5 batches × 100 = ~5 sec OpenRouter
 *   - 1 sec inter-batch sleep — under OpenRouter free-tier ceilings
 *   - maxDuration 300 sec keeps Vercel-invoke comfortable
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { EMBEDDING_MODEL } from '@/lib/llm-models'

export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BATCH_SIZE = 100
const PER_RUN_CAP = 500
const INTER_BATCH_SLEEP_MS = 1000
const MAX_INPUT_CHARS = 8000

type ProductRow = {
  id: string
  slug: string
  name: string
  steel_grade: string | null
  dimensions: string | null
  category_id: string
  categories: { name: string | null } | null
}

function buildInputText(p: ProductRow): string {
  const parts: string[] = [p.name.trim()]
  if (p.steel_grade) parts.push(`Марка: ${p.steel_grade}`)
  if (p.dimensions && p.dimensions.trim() && p.dimensions !== '{}') {
    parts.push(`Размеры: ${p.dimensions}`)
  }
  if (p.categories?.name) parts.push(`Категория: ${p.categories.name}`)
  const joined = parts.join(' | ')
  return joined.length > MAX_INPUT_CHARS ? joined.slice(0, MAX_INPUT_CHARS) : joined
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Match OpenRouter convention when API_BASE is set (`openai/<model>`).
// Default EMBEDDING_MODEL is `text-embedding-3-small`; route via OpenRouter
// gets `openai/text-embedding-3-small`, native OpenAI keeps unprefixed.
function resolveEmbeddingModel(): string {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  const apiBase = process.env.OPENAI_API_BASE ?? ''
  const isOpenRouter = apiBase.includes('openrouter.ai') || apiKey.startsWith('sk-or-')
  if (isOpenRouter && !EMBEDDING_MODEL.startsWith('openai/')) {
    return `openai/${EMBEDDING_MODEL}`
  }
  return EMBEDDING_MODEL
}

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer /, '') ??
    null
  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Pull pending products ──────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const { data: pending, error: fetchErr } = await supabase
    .from('products')
    .select('id, slug, name, steel_grade, dimensions, category_id, categories(name)')
    .eq('is_active', true)
    .is('embedding', null)
    .order('id')
    .limit(PER_RUN_CAP)

  if (fetchErr) {
    return NextResponse.json({ status: 'error', step: 'fetch', error: fetchErr.message }, { status: 500 })
  }

  const products = (pending ?? []) as unknown as ProductRow[]
  if (products.length === 0) {
    return NextResponse.json({ status: 'no_pending', processed: 0, model: resolveEmbeddingModel() })
  }

  // ── Embed & store ──────────────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json({ status: 'error', step: 'openai_key', error: 'OPENAI_API_KEY not set' }, { status: 500 })
  }
  const openai = new OpenAI({
    apiKey: openaiKey,
    ...(process.env.OPENAI_API_BASE ? { baseURL: process.env.OPENAI_API_BASE } : {}),
  })
  const model = resolveEmbeddingModel()

  let processed = 0
  let failed = 0
  const errors: string[] = []
  const batches = chunks(products, BATCH_SIZE)

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]
    const inputs = batch.map(buildInputText)
    const startedAt = new Date().toISOString()

    // Mark jobs as 'processing'
    await supabase
      .from('products_embedding_jobs')
      .upsert(
        batch.map((p) => ({
          product_id: p.id,
          status: 'processing' as const,
          embedding_model: EMBEDDING_MODEL,
          source_text: buildInputText(p),
          started_at: startedAt,
        })),
        { onConflict: 'product_id,embedding_model' },
      )

    try {
      const res = await openai.embeddings.create({ model, input: inputs })
      if (res.data.length !== batch.length) {
        throw new Error(`expected ${batch.length} embeddings, got ${res.data.length}`)
      }
      for (let i = 0; i < batch.length; i++) {
        const p = batch[i]
        const vec = res.data[i].embedding
        const { error: updErr } = await supabase
          .from('products')
          .update({ embedding: vec as unknown as string })
          .eq('id', p.id)
        if (updErr) {
          await supabase
            .from('products_embedding_jobs')
            .update({ status: 'failed', error: updErr.message })
            .eq('product_id', p.id)
            .eq('embedding_model', EMBEDDING_MODEL)
          failed++
          errors.push(`${p.slug}: ${updErr.message}`)
          continue
        }
        await supabase
          .from('products_embedding_jobs')
          .update({ status: 'done', generated_at: new Date().toISOString(), error: null })
          .eq('product_id', p.id)
          .eq('embedding_model', EMBEDDING_MODEL)
        processed++
      }
    } catch (e: unknown) {
      const msg = (e as Error).message ?? String(e)
      await supabase
        .from('products_embedding_jobs')
        .update({ status: 'failed', error: msg })
        .in('product_id', batch.map((p) => p.id))
        .eq('embedding_model', EMBEDDING_MODEL)
      failed += batch.length
      errors.push(`batch ${bi + 1}: ${msg}`)
    }

    if (bi < batches.length - 1) await sleep(INTER_BATCH_SLEEP_MS)
  }

  return NextResponse.json({
    status: failed === 0 ? 'done' : 'partial',
    model,
    processed,
    failed,
    pending_remaining: Math.max(0, products.length - processed - failed),
    errors: errors.slice(0, 10),
  })
}

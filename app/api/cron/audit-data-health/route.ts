/**
 * /api/cron/audit-data-health
 *
 * Hourly Vercel Cron (vercel.json: "0 * * * *")
 * Запускает 5 проверок качества данных → заполняет data_quality_queue.
 *
 * Та же логика что в scripts/audit_data_health.ts
 * Аутентификация: заголовок X-Cron-Secret (= CRON_SECRET в Vercel env)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

const STALE_PRICE_DAYS = 7
const SPREAD_PCT_THRESHOLD = 10
const PAGE_SIZE = 1000

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

type Severity = 'critical' | 'warning' | 'info'
type DqIssue = {
  issue_type: string
  product_id: string | null
  price_item_id: string | null
  severity: Severity
  details: Record<string, unknown>
}

let upserted = 0

async function upsertIssue(client: ReturnType<typeof sb>, issue: DqIssue) {
  const { error } = await client.rpc('upsert_dq_issue', {
    p_tenant_id: TENANT_ID,
    p_issue_type: issue.issue_type,
    p_product_id: issue.product_id,
    p_price_item_id: issue.price_item_id,
    p_severity: issue.severity,
    p_details: issue.details,
  })
  if (!error) upserted++
}

async function runChecks() {
  const client = sb()
  const results: Record<string, number> = {}

  // ─── 1. Stale prices ────────────────────────────────────────────────────
  const since = new Date(Date.now() - STALE_PRICE_DAYS * 86_400_000).toISOString()
  let from = 0
  let staleCount = 0
  while (true) {
    const { data, error } = await client
      .from('price_items')
      .select('id, product_id, base_price, updated_at, supplier_id')
      .lt('updated_at', since)
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data?.length) break
    for (const row of data) {
      const ageDays = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86_400_000)
      await upsertIssue(client, {
        issue_type: 'stale_price',
        product_id: row.product_id,
        price_item_id: row.id,
        severity: ageDays > 30 ? 'critical' : 'warning',
        details: { last_updated: row.updated_at, age_days: ageDays, supplier_id: row.supplier_id, base_price: row.base_price },
      })
      staleCount++
    }
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  results['stale_price'] = staleCount

  // ─── 2. Missing prices ──────────────────────────────────────────────────
  const { data: noPriceRows } = await client.rpc('products_without_prices')
  for (const row of (noPriceRows ?? []) as Array<{ id: string; name: string }>) {
    await upsertIssue(client, {
      issue_type: 'missing_price',
      product_id: row.id,
      price_item_id: null,
      severity: 'critical',
      details: { product_name: row.name },
    })
  }
  results['missing_price'] = noPriceRows?.length ?? 0

  // ─── 3. Zero prices ──────────────────────────────────────────────────────
  from = 0
  let zeroCount = 0
  while (true) {
    const { data, error } = await client
      .from('price_items')
      .select('id, product_id, supplier_id')
      .or('base_price.is.null,base_price.eq.0')
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data?.length) break
    for (const row of data) {
      await upsertIssue(client, {
        issue_type: 'zero_price',
        product_id: row.product_id,
        price_item_id: row.id,
        severity: 'critical',
        details: { supplier_id: row.supplier_id },
      })
      zeroCount++
    }
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  results['zero_price'] = zeroCount

  // ─── 4. Cross-supplier price spread ──────────────────────────────────────
  from = 0
  const grouped: Record<string, { prices: number[]; suppliers: Set<string> }> = {}
  while (true) {
    const { data, error } = await client
      .from('price_items')
      .select('product_id, base_price, supplier_id')
      .gt('base_price', 0)
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data?.length) break
    for (const row of data) {
      if (!row.product_id) continue
      grouped[row.product_id] ??= { prices: [], suppliers: new Set() }
      grouped[row.product_id].prices.push(Number(row.base_price))
      grouped[row.product_id].suppliers.add(row.supplier_id)
    }
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  let spreadCount = 0
  for (const [product_id, g] of Object.entries(grouped)) {
    if (g.prices.length < 2) continue
    const min = Math.min(...g.prices)
    const max = Math.max(...g.prices)
    if (min === 0) continue
    const spread = ((max - min) / min) * 100
    if (spread > SPREAD_PCT_THRESHOLD) {
      spreadCount++
      await upsertIssue(client, {
        issue_type: 'price_mismatch',
        product_id,
        price_item_id: null,
        severity: spread > 30 ? 'critical' : 'warning',
        details: { min, max, spread_pct: Math.round(spread), supplier_count: g.suppliers.size },
      })
    }
  }
  results['price_mismatch'] = spreadCount

  // ─── 5. Missing images ───────────────────────────────────────────────────
  from = 0
  let imgCount = 0
  while (true) {
    const { data, error } = await client
      .from('products')
      .select('id, name')
      .or('image_url.is.null,image_url.eq.')
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data?.length) break
    for (const row of data) {
      await upsertIssue(client, {
        issue_type: 'missing_image',
        product_id: row.id,
        price_item_id: null,
        severity: 'info',
        details: { product_name: row.name },
      })
      imgCount++
    }
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  results['missing_image'] = imgCount

  return results
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  upserted = 0

  try {
    const results = await runChecks()
    return NextResponse.json({
      ok: true,
      tenant_id: TENANT_ID,
      checks: results,
      total_upserted: upserted,
      duration_ms: Date.now() - start,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 })
  }
}

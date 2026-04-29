/**
 * scripts/audit_data_health.ts
 *
 * Сканирует products + price_items, заполняет data_quality_queue.
 * Идемпотентен: использует RPC upsert_dq_issue() с уникальным индексом по open issues.
 *
 * Запуск:
 *   npx tsx scripts/audit_data_health.ts
 *
 * Cron на Vercel (vercel.json):
 *   { "path": "/api/cron/audit-data-health", "schedule": "0 * * * *" }
 *
 * Cron на Railway (через railway.json или Procfile):
 *   audit: 0 * * * * /app/node_modules/.bin/tsx /app/scripts/audit_data_health.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TENANT_ID (default: a1000000-0000-0000-0000-000000000001)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY обязательны')
  process.exit(1)
}

const STALE_PRICE_DAYS = 7
const SUPPLIER_PRICE_MISMATCH_PCT = 10
const PAGE_SIZE = 1000

const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

type Severity = 'critical' | 'warning' | 'info'

type DqIssue = {
  issue_type: string
  product_id: string | null
  price_item_id: string | null
  severity: Severity
  details: Record<string, unknown>
}

let totalUpserted = 0

async function upsertIssue(issue: DqIssue): Promise<void> {
  const { error } = await sb.rpc('upsert_dq_issue', {
    p_tenant_id: TENANT_ID,
    p_issue_type: issue.issue_type,
    p_product_id: issue.product_id,
    p_price_item_id: issue.price_item_id,
    p_severity: issue.severity,
    p_details: issue.details,
  })
  if (error) {
    console.error(`  ✗ upsert ${issue.issue_type}: ${error.message}`)
  } else {
    totalUpserted++
  }
}

async function* paginate<T>(
  table: string,
  select: string,
  filter?: (q: any) => any
): AsyncGenerator<T[]> {
  let from = 0
  while (true) {
    let q = sb.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table} fetch error: ${error.message}`)
    if (!data || data.length === 0) return
    yield data as T[]
    if (data.length < PAGE_SIZE) return
    from += PAGE_SIZE
  }
}

// ─── Check 1: stale prices ───────────────────────────────────────────────
async function checkStalePrices() {
  console.log('[1/5] Stale prices (>7d)...')
  const since = new Date(Date.now() - STALE_PRICE_DAYS * 86_400_000).toISOString()
  let count = 0
  for await (const batch of paginate<{ id: string; product_id: string; base_price: number; updated_at: string; supplier_id: string }>(
    'price_items',
    'id, product_id, base_price, updated_at, supplier_id',
    (q) => q.lt('updated_at', since)
  )) {
    for (const row of batch) {
      const ageDays = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86_400_000)
      await upsertIssue({
        issue_type: 'stale_price',
        product_id: row.product_id,
        price_item_id: row.id,
        severity: ageDays > 30 ? 'critical' : 'warning',
        details: {
          last_updated: row.updated_at,
          age_days: ageDays,
          supplier_id: row.supplier_id,
          base_price: row.base_price,
        },
      })
      count++
    }
  }
  console.log(`  ${count} flagged`)
}

// ─── Check 2: products without any price_items ───────────────────────────
async function checkMissingPrices() {
  console.log('[2/5] Products without price_items...')
  const { data, error } = await sb.rpc('products_without_prices')
  if (error) {
    console.error('  RPC error, falling back:', error.message)
    return
  }
  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    await upsertIssue({
      issue_type: 'missing_price',
      product_id: row.id,
      price_item_id: null,
      severity: 'critical',
      details: { product_name: row.name },
    })
  }
  console.log(`  ${data?.length ?? 0} flagged`)
}

// ─── Check 3: zero / null prices ─────────────────────────────────────────
async function checkZeroPrices() {
  console.log('[3/5] Zero or NULL prices...')
  let count = 0
  for await (const batch of paginate<{ id: string; product_id: string; supplier_id: string }>(
    'price_items',
    'id, product_id, supplier_id',
    (q) => q.or('base_price.is.null,base_price.eq.0')
  )) {
    for (const row of batch) {
      await upsertIssue({
        issue_type: 'zero_price',
        product_id: row.product_id,
        price_item_id: row.id,
        severity: 'critical',
        details: { supplier_id: row.supplier_id },
      })
      count++
    }
  }
  console.log(`  ${count} flagged`)
}

// ─── Check 4: price spread between suppliers >10% ────────────────────────
async function checkPriceMismatch() {
  console.log('[4/5] Cross-supplier price spread >10%...')
  const grouped: Record<string, { prices: number[]; suppliers: Set<string> }> = {}

  for await (const batch of paginate<{ product_id: string; base_price: number; supplier_id: string }>(
    'price_items',
    'product_id, base_price, supplier_id',
    (q) => q.gt('base_price', 0)
  )) {
    for (const row of batch) {
      if (!row.product_id) continue
      grouped[row.product_id] ??= { prices: [], suppliers: new Set() }
      grouped[row.product_id].prices.push(Number(row.base_price))
      grouped[row.product_id].suppliers.add(row.supplier_id)
    }
  }

  let mismatches = 0
  for (const [product_id, g] of Object.entries(grouped)) {
    if (g.prices.length < 2) continue
    const min = Math.min(...g.prices)
    const max = Math.max(...g.prices)
    if (min === 0) continue
    const spread = ((max - min) / min) * 100
    if (spread > SUPPLIER_PRICE_MISMATCH_PCT) {
      mismatches++
      await upsertIssue({
        issue_type: 'price_mismatch',
        product_id,
        price_item_id: null,
        severity: spread > 30 ? 'critical' : 'warning',
        details: {
          min,
          max,
          spread_pct: Math.round(spread),
          supplier_count: g.suppliers.size,
        },
      })
    }
  }
  console.log(`  ${mismatches} flagged`)
}

// ─── Check 5: missing images (info-level) ────────────────────────────────
async function checkMissingImages() {
  console.log('[5/5] Missing images...')
  let count = 0
  for await (const batch of paginate<{ id: string; name: string }>(
    'products',
    'id, name',
    (q) => q.or('image_url.is.null,image_url.eq.')
  )) {
    for (const row of batch) {
      await upsertIssue({
        issue_type: 'missing_image',
        product_id: row.id,
        price_item_id: null,
        severity: 'info',
        details: { product_name: row.name },
      })
      count++
    }
  }
  console.log(`  ${count} flagged`)
}

// ─── Summary ─────────────────────────────────────────────────────────────
async function summary() {
  const { data, error } = await sb
    .from('data_quality_queue')
    .select('issue_type, severity', { count: 'exact', head: false })
    .eq('status', 'open')
    .eq('tenant_id', TENANT_ID)

  if (error) {
    console.error('summary error:', error.message)
    return
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = `${row.severity}/${row.issue_type}`
    counts[key] = (counts[key] || 0) + 1
  }

  console.log('\n─── OPEN ISSUES SUMMARY ───')
  for (const [key, n] of Object.entries(counts).sort()) {
    console.log(`  ${key.padEnd(34)} ${n}`)
  }
  console.log(`  TOTAL OPEN: ${data?.length ?? 0}`)
  console.log(`  TOTAL UPSERTED THIS RUN: ${totalUpserted}`)
}

async function main() {
  const start = Date.now()
  console.log(`[audit_data_health] start ${new Date().toISOString()} tenant=${TENANT_ID}`)
  try {
    await checkStalePrices()
    await checkMissingPrices()
    await checkZeroPrices()
    await checkPriceMismatch()
    await checkMissingImages()
    await summary()
    console.log(`[audit_data_health] done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
    process.exit(0)
  } catch (err) {
    console.error('[audit_data_health] FATAL:', err)
    process.exit(1)
  }
}

main()

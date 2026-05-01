import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST /api/admin/products/markup
 * Body: { ids: string[], pct: number }
 *
 * Multiplies each price_items.base_price tied to the given product
 * IDs by (1 + pct/100), rounded to two decimals.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const body = await req.json().catch(() => null)
  const ids: string[] | null = Array.isArray(body?.ids) ? body.ids : null
  const pct: number = typeof body?.pct === 'number' ? body.pct : NaN
  if (!ids?.length || !Number.isFinite(pct) || pct === 0) {
    return NextResponse.json({ error: 'ids[] and non-zero pct required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: items, error } = await admin
    .from('price_items')
    .select('id, base_price')
    .in('product_id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const factor = 1 + pct / 100
  let updated = 0
  const rows = (items ?? []) as Array<{ id: string; base_price: number | null }>
  for (const it of rows) {
    if (typeof it.base_price !== 'number') continue
    const newPrice = Math.round(it.base_price * factor * 100) / 100
    const { error: upErr } = await admin
      .from('price_items')
      .update({ base_price: newPrice } as never)
      .eq('id', it.id)
    if (!upErr) updated++
  }

  return NextResponse.json({ ok: true, updated, items: items?.length ?? 0 })
}

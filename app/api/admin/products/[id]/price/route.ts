import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/products/[id]/price
 * Body: { base_price: number, discount_price?: number | null }
 *
 * Updates the price_items row(s) tied to this product. If multiple
 * price_items exist (multiple suppliers), updates all of them — admin
 * UI editing a single price assumes one supplier per product.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body.base_price !== 'number') {
    return NextResponse.json({ error: 'base_price (number) required' }, { status: 400 })
  }
  const update: { base_price: number; discount_price?: number | null } = { base_price: body.base_price }
  if ('discount_price' in body) update.discount_price = body.discount_price ?? null

  const admin = createAdminClient()
  const { data, error } = await admin.from('price_items').update(update as never).eq('product_id', id).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

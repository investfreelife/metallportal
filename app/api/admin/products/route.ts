import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const SELECT_COLUMNS =
  'id, name, slug, gost, steel_grade, unit, description, image_url, category_id, ' +
  'category:categories(name, slug), price_items(id, base_price, discount_price)'

/**
 * GET /api/admin/products?search=&category_id=&limit=&offset=
 * Designer role can also list (used by photo editor).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(['admin', 'designer'])
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim()
  const categoryId = url.searchParams.get('category_id')
  const categoryIdsParam = url.searchParams.get('category_ids')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500'), 2000)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const admin = createAdminClient()
  let q = admin.from('products').select(SELECT_COLUMNS).order('name')
  if (search) q = q.ilike('name', `%${search}%`)
  if (categoryIdsParam) {
    const ids = categoryIdsParam.split(',').filter(Boolean)
    if (ids.length) q = q.in('category_id', ids)
  } else if (categoryId) {
    q = q.eq('category_id', categoryId)
  }
  q = q.range(offset, offset + limit - 1)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/admin/products
 * Body: any insertable product fields.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('products').insert(body as never).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

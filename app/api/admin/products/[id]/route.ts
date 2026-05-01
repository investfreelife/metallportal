import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/products/[id]
 * Body: partial product update.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('products').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * DELETE /api/admin/products/[id]
 * Single delete. Bulk delete uses POST /api/admin/products/bulk-delete.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error
  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

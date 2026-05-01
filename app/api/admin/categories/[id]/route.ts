import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/categories/[id]
 * Body: partial category update (e.g. { is_active: true } toggle, image_url, name, ...).
 * Designer can update image_url only (photo workflow); admin — everything.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole(['admin', 'designer'])
  if (!auth.ok) return auth.error
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // Designer is restricted to image_url only
  if (auth.role === 'designer') {
    const allowed = Object.keys(body).every(k => k === 'image_url')
    if (!allowed) {
      return NextResponse.json({ error: 'designer can only update image_url' }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('categories').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * DELETE /api/admin/categories/[id]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error
  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

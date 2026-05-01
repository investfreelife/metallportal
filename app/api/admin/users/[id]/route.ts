import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const ALLOWED_ROLES = ['admin', 'designer', 'manager']

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/users/[id]
 * Body: { full_name?, role? }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error
  const { id } = await params

  let body: { full_name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const update: Record<string, string | null> = {}
  if (body.full_name !== undefined) update.full_name = body.full_name?.trim() || null
  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.includes(body.role)) {
      return NextResponse.json({ error: `role must be one of ${ALLOWED_ROLES.join(', ')}` }, { status: 400 })
    }
    update.role = body.role
  }
  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/admin/users/[id]
 * Removes auth.users row (cascades to profiles via FK).
 * Self-delete is blocked (you can't lock yourself out).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error
  const { id } = await params

  if (id === auth.userId) {
    return NextResponse.json({ error: 'cannot delete self' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const ALLOWED_ROLES = ['admin', 'designer', 'manager'] as const
type Role = typeof ALLOWED_ROLES[number]

/**
 * POST /api/admin/users/invite
 * Body: { email, full_name?, role }
 * Sends Supabase Auth invite email + creates profile row.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  let body: { email?: string; full_name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const role = body.role as Role
  const fullName = body.full_name?.trim() || null

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of ${ALLOWED_ROLES.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Send Supabase invite (creates auth.users row, sends email with link)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'invite failed' }, { status: 500 })
  }

  // Upsert profile with role
  const { error: profErr } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role, full_name: fullName }, { onConflict: 'id' })
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.user.id, email })
}

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/admin/users
 * Returns admin/designer/manager users joined with their auth.users data.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const admin = createAdminClient()

  // Join profiles + auth.users via admin API. List all auth users, then
  // attach their profile rows. Filter to roles that participate in admin.
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, full_name, role, telegram_chat_id, created_at')
    .in('role', ['admin', 'designer', 'manager'])
    .order('created_at', { ascending: true })

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

  // Hydrate emails + last_sign_in_at from auth.users
  const { data: { users }, error: authErr } = await admin.auth.admin.listUsers()
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  const userMap = new Map(users.map(u => [u.id, u]))
  type ProfileRow = {
    id: string
    full_name: string | null
    role: string | null
    telegram_chat_id: string | null
    created_at: string | null
  }
  const profileRows = (profiles ?? []) as ProfileRow[]
  const result = profileRows.map(p => {
    const u = userMap.get(p.id)
    return {
      id: p.id,
      email: u?.email ?? null,
      full_name: p.full_name,
      role: p.role,
      telegram_chat_id: p.telegram_chat_id,
      created_at: p.created_at,
      last_sign_in_at: u?.last_sign_in_at ?? null,
      email_confirmed: !!u?.email_confirmed_at,
    }
  })

  return NextResponse.json(result)
}

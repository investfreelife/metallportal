import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from './supabase'

/**
 * Reads the current Supabase Auth user from request cookies.
 * Returns null if no session.
 *
 * Uses anon key + cookie-based session — the SSR client validates the
 * JWT against Supabase. No service-role key in client bundle.
 */
export async function getCurrentUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Route handlers / server components cannot mutate cookies after
          // headers are sent. Login flow handles set/remove via response.
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Resolves the current user's role from public.profiles.
 * Uses service_role to bypass RLS (we need this even when the user
 * has no SELECT policy on profiles; relying on RLS would create
 * a chicken-and-egg).
 *
 * Returns null if no session or no profile row.
 */
export async function getCurrentRole(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data as { role?: string } | null)?.role ?? null
}

export type AuthOk = { ok: true; userId: string; role: string }
export type AuthErr = { ok: false; error: NextResponse }
export type AuthResult = AuthOk | AuthErr

/**
 * Use at the top of any /api/admin/* route handler:
 *   const auth = await requireAdmin()
 *   if (!auth.ok) return auth.error
 */
export async function requireAdmin(): Promise<AuthResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = (data as { role?: string } | null)?.role ?? null

  if (role !== 'admin') {
    return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, role }
}

/**
 * Use when a route accepts multiple roles:
 *   const auth = await requireRole(['admin', 'designer'])
 *   if (!auth.ok) return auth.error
 */
export async function requireRole(allowed: string[]): Promise<AuthResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = (data as { role?: string } | null)?.role ?? null

  if (!role || !allowed.includes(role)) {
    return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, role }
}

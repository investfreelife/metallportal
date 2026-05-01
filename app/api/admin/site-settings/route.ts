import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/admin/site-settings[?prefix=homepage_]
 * Returns key/value pairs from public.site_settings.
 *
 * Used by both /admin/settings and /admin/homepage admin pages —
 * they filter by their own prefix client-side or via ?prefix=.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const prefix = new URL(req.url).searchParams.get('prefix')

  const admin = createAdminClient()
  let q = admin.from('site_settings').select('key, value')
  if (prefix) q = q.like('key', `${prefix}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * PUT /api/admin/site-settings
 * Body: { key, value }  — upsert a single setting
 *  OR   { entries: [{ key, value }, ...] }  — batch upsert
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid json' }, { status: 400 })

  const entries: Array<{ key: string; value: unknown }> = Array.isArray(body.entries)
    ? body.entries
    : (typeof body.key === 'string' ? [{ key: body.key, value: body.value }] : [])

  if (!entries.length) {
    return NextResponse.json({ error: 'key/value or entries[] required' }, { status: 400 })
  }
  for (const e of entries) {
    if (typeof e.key !== 'string' || !e.key) {
      return NextResponse.json({ error: 'each entry needs string key' }, { status: 400 })
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from('site_settings').upsert(
    entries.map(e => ({ key: e.key, value: e.value, updated_at: now })) as never,
    { onConflict: 'key' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: entries.length })
}

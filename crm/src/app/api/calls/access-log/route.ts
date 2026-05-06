import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/calls/access-log
 *
 * Records a `call_access_log` entry when a manager performs an audited
 * action on a call recording / transcript (LAW-contact-privacy §4).
 *
 * Body: { call_id: string, access_type: string }
 *   access_type ∈ ('list_view' | 'detail_view' | 'recording_listened'
 *                  | 'transcript_viewed' | 'recording_downloaded')
 *
 * Auth: requireRole(['owner','admin','manager','staff']).
 *
 * Inserts via service-role; RLS на call_access_log enforces tenant_isolation
 * для user-facing reads.
 */

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

const VALID_TYPES = [
  'list_view',
  'detail_view',
  'recording_listened',
  'transcript_viewed',
  'recording_downloaded',
] as const

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin', 'manager', 'staff'])
  if (!auth.ok) return auth.error

  let body: { call_id?: string; access_type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const callId = (body.call_id ?? '').trim()
  const accessType = (body.access_type ?? '').trim()
  if (!callId || !VALID_TYPES.includes(accessType as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: 'call_id + valid access_type required' },
      { status: 400 },
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  const ua = req.headers.get('user-agent')

  // CrmSession не несёт userId — резолвим admin_users.id по login
  let accessedBy: string | null = null
  if (auth.session.login) {
    const { data: u } = await supabase
      .from('admin_users')
      .select('id')
      .eq('login', auth.session.login)
      .maybeSingle()
    accessedBy = (u as { id?: string } | null)?.id ?? null
  }

  const { error } = await supabase.from('call_access_log').insert({
    tenant_id: TENANT_ID,
    call_id: callId,
    accessed_by: accessedBy,
    access_type: accessType,
    ip_address: ip,
    user_agent: ua,
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[calls/access-log] insert error:', error.message)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

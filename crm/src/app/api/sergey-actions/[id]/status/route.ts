import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionFromRequest } from '@/lib/session'

/**
 * POST /api/sergey-actions/[id]/status
 *
 * Manual status update от Sergey (clicked checkbox в UI) или CLI (cron).
 * Auth: либо CRM session cookie (browser), либо x-agent-token header (CLI).
 *
 * Body: { status: 'done' | 'pending' | 'in_progress' | 'blocked' | 'wont_do',
 *          done_by?: string, blocked_reason?: string }
 *
 * Trigger sergey_actions_log_change логирует изменение автоматически.
 */

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['pending', 'in_progress', 'done', 'blocked', 'wont_do'])

function checkAuth(request: NextRequest): { ok: true; doneBy: string } | { ok: false; error: NextResponse } {
  // Session cookie (browser)
  const session = getSessionFromRequest(request.headers.get('cookie'))
  if (session) return { ok: true, doneBy: session.login || 'sergey' }

  // x-agent-token (CLI / cron)
  const token = request.headers.get('x-agent-token')
  const expected = process.env.AGENT_WEBHOOK_TOKEN
  if (expected && token && token === expected) {
    return { ok: true, doneBy: 'cli' }
  }

  return {
    ok: false,
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = checkAuth(request)
  if (!auth.ok) return auth.error

  const { id } = await params
  const actionId = parseInt(id, 10)
  if (Number.isNaN(actionId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const newStatus = String(body.status || '').trim()
  if (!ALLOWED_STATUS.has(newStatus)) {
    return NextResponse.json(
      { error: 'invalid_status', allowed: [...ALLOWED_STATUS] },
      { status: 400 }
    )
  }

  const doneBy = typeof body.done_by === 'string' && body.done_by.trim()
    ? body.done_by.slice(0, 80)
    : auth.doneBy
  const blockedReason = typeof body.blocked_reason === 'string' ? body.blocked_reason.slice(0, 500) : null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const patch: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'done') {
    patch.done_at = new Date().toISOString()
    patch.done_by = doneBy
  }
  if (newStatus === 'blocked') {
    patch.blocked_reason = blockedReason
    patch.blocked_since = new Date().toISOString()
  } else {
    patch.blocked_reason = null
    patch.blocked_since = null
  }

  const { data, error } = await supabase
    .from('sergey_actions')
    .update(patch)
    .eq('id', actionId)
    .select('id, slug, status, done_at, done_by')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: data })
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireSharedSecret } from '@/lib/apiAuth'

/**
 * Agent orchestration event ingest endpoint.
 *
 * POST /api/agent-events
 * Headers: x-agent-token: AGENT_WEBHOOK_TOKEN (timing-safe compared via requireSharedSecret)
 *
 * Body (JSON):
 *   agent_name:  string  — required, lowercase (иван / юля / антон / катя / алексей / павел / михаил / никита)
 *   event_type:  string  — required ('pulse' | 'commit' | 'report' | 'task_start' | 'task_end' | 'blocked')
 *   message:     string  — required, 1-2 sentences human-readable
 *   task_id:     string  — optional
 *   commit_sha:  string  — optional
 *   severity:    string  — optional ('info' | 'warn' | 'critical'), default 'info'
 *   metadata:    object  — optional JSONB
 *
 * Source: 2026-05-16 DISPATCH OPERATOR_TO_CRM. Called by:
 *   - scripts/auto_checkpoint.sh (commit events)
 *   - scripts/agent_init.sh      (task_start events)
 *   - scripts/agent_report.sh    (report events)
 *   - scripts/backfill_pulse_to_crm.sh (one-time backfill from pulse.md)
 *
 * Realtime: каждый INSERT broadcastится через supabase_realtime publication
 * на TeamActivityFeed клиентов через channel('agent_events').
 */

export const dynamic = 'force-dynamic'

const ALLOWED_EVENT_TYPES = new Set([
  'pulse', 'commit', 'report', 'task_start', 'task_end', 'blocked',
])
const ALLOWED_SEVERITY = new Set(['info', 'warn', 'critical'])

export async function POST(request: NextRequest) {
  const auth = requireSharedSecret(request, 'AGENT_WEBHOOK_TOKEN', 'x-agent-token')
  if (!auth.ok) return auth.error

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const agent_name = typeof body.agent_name === 'string' ? body.agent_name.trim().toLowerCase() : ''
  const event_type = typeof body.event_type === 'string' ? body.event_type.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const task_id = typeof body.task_id === 'string' && body.task_id.trim() ? body.task_id.trim() : null
  const commit_sha = typeof body.commit_sha === 'string' && body.commit_sha.trim() ? body.commit_sha.trim() : null
  const severityRaw = typeof body.severity === 'string' ? body.severity.trim() : 'info'
  const severity = ALLOWED_SEVERITY.has(severityRaw) ? severityRaw : 'info'
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}

  if (!agent_name) return NextResponse.json({ error: 'agent_name_required' }, { status: 400 })
  if (!event_type) return NextResponse.json({ error: 'event_type_required' }, { status: 400 })
  if (!ALLOWED_EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: `event_type_invalid`, allowed: [...ALLOWED_EVENT_TYPES] }, { status: 400 })
  }
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 })
  if (message.length > 2000) {
    return NextResponse.json({ error: 'message_too_long', max: 2000 }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'supabase_misconfigured' }, { status: 500 })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('agent_events')
    .insert({ agent_name, event_type, message, task_id, commit_sha, severity, metadata })
    .select('id, created_at')
    .single()

  if (error) {
    console.error('[agent-events] insert error', error)
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id, created_at: data?.created_at })
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/agent-events',
    method: 'POST',
    required_headers: ['x-agent-token'],
    required_body: ['agent_name', 'event_type', 'message'],
    allowed_event_types: [...ALLOWED_EVENT_TYPES],
  })
}

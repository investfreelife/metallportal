import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/transfer-pending
 *
 * Called by Voximplant inbound scenario when manager leg disconnects —
 * scenario asks: «is there a pending transfer for this session?». If yes,
 * scenario calls the new manager phone instead of terminating.
 *
 * Atomic claim pattern: we SELECT-and-UPDATE in одной transaction —
 * once claimed, `pending_transfer_phone` is cleared so re-fires won't
 * double-call.
 *
 * Body (JSON):
 *   { voximplant_session_id: string }
 *
 * Returns:
 *   { pending: false } — no transfer, scenario terminates as normal
 *   { pending: true, transfer_to_phone: '+79...', call_id: '<uuid>' }
 *
 * Auth: shared `X-Voximplant-Secret` header.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const secret = process.env.VOXIMPLANT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }
  const provided = req.headers.get('x-voximplant-secret')
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { voximplant_session_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const sessionId = (body.voximplant_session_id ?? '').trim()
  if (!sessionId) {
    return NextResponse.json({ error: 'voximplant_session_id required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Claim atomically — UPDATE и RETURNING
  const { data, error } = await sb
    .from('calls')
    .update({
      pending_transfer_phone: null,
      pending_transfer_user_id: null,
      pending_transfer_at: null,
    })
    .eq('voximplant_session_id', sessionId)
    .not('pending_transfer_phone', 'is', null)
    .select('id, pending_transfer_phone, pending_transfer_user_id')
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[voximplant/transfer-pending] error:', error.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ pending: false })
  }

  // Audit log
  const row = data as {
    id: string
    pending_transfer_phone: string
    pending_transfer_user_id: string | null
  }
  await sb.from('call_routing_log').insert({
    tenant_id: TENANT_ID,
    voximplant_session_id: sessionId,
    routed_to_user_id: row.pending_transfer_user_id,
    routed_to_phone: row.pending_transfer_phone,
    routing_reason: 'manager_transfer',
  })

  return NextResponse.json({
    pending: true,
    transfer_to_phone: row.pending_transfer_phone,
    call_id: row.id,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

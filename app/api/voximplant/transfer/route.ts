import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/transfer
 *
 * Mid-call transfer initiator. Called by CRM proxy (which holds shared
 * secret + admin session gate).
 *
 * Mechanism (Phase 1 — flag-driven re-route):
 *   1. Mark `calls` row с `pending_transfer_phone` (target manager's phone).
 *   2. Send Voximplant `Calls/Disconnect` to current manager's call-leg.
 *   3. Inbound scenario detects manager leg disconnect → POSTs к
 *      /api/voximplant/transfer-pending — gets target phone — calls it
 *      instead of terminating.
 *   4. Caller hears brief silence, then bridged with new manager.
 *
 * Phase 2 (next ТЗ): proper VoxEngine bridge swap — no caller-side gap.
 *
 * Body (JSON):
 *   {
 *     voximplant_session_id: string,
 *     transfer_to_phone: string (E.164),
 *     transfer_to_user_id?: string,
 *     initiated_by?: string (admin_users.id для audit)
 *   }
 *
 * Auth: `X-Voximplant-Secret` header (CRM proxy adds it).
 *
 * NOTE: Voximplant `Calls/Hangup` endpoint deprecated; current API uses
 * `Sessions/HangupSession`. Phase 1 uses scenario-cooperative pattern:
 * we just SET pending_transfer_phone and rely on scenario's existing
 * Disconnected handler to call our /transfer-pending endpoint AT
 * natural call-end time. For TRUE mid-call interrupt (без waiting until
 * caller hangs up), Phase 2 нужен Sessions/HangupSession integration —
 * deferred. Phase 1 only covers «transfer я следующего звонка
 * автоматически» via assigned_to update.
 *
 * For c026 launch — Sergey один manager, transfer rare. Defer real-time
 * mechanic к c027 once multi-manager onboarded.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

const E164 = /^\+\d{10,15}$/

type Creds = {
  account_email: string
  account_id: number
  key_id: string
  private_key: string
}

function loadCreds(): Creds | null {
  const b64 = process.env.VOXIMPLANT_SERVICE_ACCOUNT_BASE64
  if (!b64) return null
  try {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as Creds
  } catch {
    return null
  }
}

function authHeader(creds: Creds): string {
  const now = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    { iss: creds.account_id, iat: now, exp: now + 60 },
    creds.private_key,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: creds.key_id } },
  )
  return `Bearer ${token}`
}

export async function POST(req: NextRequest) {
  const secret = process.env.VOXIMPLANT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }
  const provided = req.headers.get('x-voximplant-secret')
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    voximplant_session_id?: string
    transfer_to_phone?: string
    transfer_to_user_id?: string
    initiated_by?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sessionId = (body.voximplant_session_id ?? '').trim()
  const transferToPhone = (body.transfer_to_phone ?? '').trim()
  if (!sessionId || !E164.test(transferToPhone)) {
    return NextResponse.json(
      { error: 'voximplant_session_id + transfer_to_phone (E.164) required' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // 1. Mark pending_transfer flags на calls row
  const { data: callRow, error: upErr } = await sb
    .from('calls')
    .update({
      pending_transfer_phone: transferToPhone,
      pending_transfer_user_id: body.transfer_to_user_id ?? null,
      pending_transfer_initiated_by: body.initiated_by ?? null,
      pending_transfer_at: new Date().toISOString(),
    })
    .eq('voximplant_session_id', sessionId)
    .select('id, voximplant_call_id')
    .maybeSingle()

  if (upErr || !callRow) {
    return NextResponse.json(
      { error: upErr?.message ?? 'Call session not found' },
      { status: 404 },
    )
  }

  // 2. Try Voximplant Sessions/HangupSession to force scenario's disconnect
  // handler to fire (which then claims the pending transfer). If creds
  // missing or call already ended naturally — flag still works on next
  // session disconnect event.
  const creds = loadCreds()
  let voxResult: Record<string, unknown> | null = null
  if (creds) {
    try {
      const params = new URLSearchParams()
      params.set('media_session_access_url_session_id', sessionId)
      const res = await fetch(
        'https://api.voximplant.com/platform_api/HangupSession/',
        {
          method: 'POST',
          headers: {
            Authorization: authHeader(creds),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      )
      voxResult = (await res.json()) as Record<string, unknown>
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[voximplant/transfer] hangup error:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    call_id: (callRow as { id: string }).id,
    voximplant_call_id: (callRow as { voximplant_call_id: string | null }).voximplant_call_id,
    transfer_to_phone: transferToPhone,
    voximplant_hangup: voxResult,
    note:
      'Pending transfer flag set. Scenario picks up on next Disconnected event. ' +
      'Phase 2: proper bridge swap — c027.',
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

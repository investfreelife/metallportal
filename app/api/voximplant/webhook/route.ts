import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/webhook
 *
 * Voximplant scenario calls this on `CallEvents.Disconnected` с метаданными
 * звонка + recording_url. Handler:
 *   1. Verifies `X-Voximplant-Secret` header (constant-time compare) против
 *      VOXIMPLANT_WEBHOOK_SECRET env.
 *   2. Parses form-urlencoded body (scenario uses URL-encoded для compat'а
 *      с VoxEngine sandbox quirks).
 *   3. UPSERT в `calls` table by `voximplant_call_id` (idempotent на retry).
 *   4. Status set к `pending_transcription` если recording_url есть, иначе
 *      `completed` (legacy missed/failed propagated если signal был).
 *
 * c024 schema:
 *   `calls.voximplant_call_id`     TEXT UNIQUE (partial)
 *   `calls.voximplant_session_id`  TEXT
 *   `calls.forwarded_to`           TEXT (для inbound forward)
 *
 * Ingest tenant: hardcoded к canonical TENANT_ID до multi-tenant.
 *
 * Body params (URL-encoded):
 *   direction              "inbound" | "outbound"
 *   voximplant_call_id     string (Voximplant Call.id())
 *   voximplant_session_id  string (VoxEngine sessionLogId)
 *   from_number            string (caller PSTN — plaintext по existing schema)
 *   to_number              string (Voximplant rented number)
 *   forwarded_to           string (e.g. +79013617775)
 *   duration               integer (seconds)
 *   recording_url          string (Voximplant signed log URL)
 *   started_at             ISO timestamp
 *   ended_at               ISO timestamp
 *
 * LAW-contact-privacy: phone numbers stored plaintext по существующей `calls`
 * schema; encryption migration отложена. RLS на `calls.tenant_id` enforced
 * для user-facing reads; service-role insertions bypass RLS.
 */

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
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

  // Body може быть либо form-urlencoded, либо JSON — accept оба
  let payload: Record<string, string>
  const contentType = req.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) {
      const json = await req.json()
      payload = Object.fromEntries(
        Object.entries(json as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
      )
    } else {
      const raw = await req.text()
      const params = new URLSearchParams(raw)
      payload = Object.fromEntries(params.entries())
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const voximplantCallId = (payload.voximplant_call_id ?? '').trim()
  if (!voximplantCallId) {
    return NextResponse.json({ error: 'voximplant_call_id required' }, { status: 400 })
  }

  const direction = payload.direction === 'outbound' ? 'outbound' : 'inbound'
  const recordingUrl = (payload.recording_url ?? '').trim() || null
  const status = recordingUrl ? 'pending_transcription' : 'completed'
  const duration = Number.parseInt(payload.duration ?? '0', 10) || 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // SELECT-then-INSERT-or-UPDATE pattern. Не используем upsert потому что
  // на retry хотим preserve existing recording_url если новый payload его
  // не содержит (defensive — Voximplant отдельные fields в split payloads).
  const { data: existing } = await sb
    .from('calls')
    .select('id, recording_url, status')
    .eq('voximplant_call_id', voximplantCallId)
    .maybeSingle()

  if (existing) {
    // UPDATE: keep recording_url if existing has one; merge non-null fields
    const update: Record<string, unknown> = {
      direction,
      from_number: payload.from_number ?? null,
      to_number: payload.to_number ?? null,
      forwarded_to: payload.forwarded_to ?? null,
      duration,
      voximplant_session_id: payload.voximplant_session_id ?? null,
      started_at: payload.started_at ?? null,
      ended_at: payload.ended_at ?? null,
    }
    // Don't downgrade: only update recording_url + status if new payload provides them
    if (recordingUrl) {
      update.recording_url = recordingUrl
      update.status = 'pending_transcription'
    }
    const { error: upErr } = await sb
      .from('calls')
      .update(update)
      .eq('id', (existing as { id: string }).id)
    if (upErr) {
      // eslint-disable-next-line no-console
      console.error('[voximplant/webhook] update error:', upErr.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      call_id: (existing as { id: string }).id,
      status: recordingUrl ? 'pending_transcription' : (existing as { status: string }).status,
      action: 'updated',
    })
  }

  // INSERT new row
  const insert = {
    tenant_id: TENANT_ID,
    direction,
    status,
    from_number: payload.from_number ?? null,
    to_number: payload.to_number ?? null,
    forwarded_to: payload.forwarded_to ?? null,
    duration,
    recording_url: recordingUrl,
    voximplant_call_id: voximplantCallId,
    voximplant_session_id: payload.voximplant_session_id ?? null,
    started_at: payload.started_at ?? null,
    ended_at: payload.ended_at ?? null,
  }

  const { data, error } = await sb
    .from('calls')
    .insert(insert)
    .select('id, status')
    .single()

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[voximplant/webhook] insert error:', error.message)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    call_id: (data as { id: string }).id,
    status: (data as { status: string }).status,
    action: 'inserted',
  })
}

// Reject other methods explicitly (helps debugging — Voximplant scenario
// crashes silently если пометил wrong URL).
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

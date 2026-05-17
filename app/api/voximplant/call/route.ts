import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/call
 *
 * Server-initiated outbound «callback» — CRM (or other internal client)
 * triggers a Voximplant scenario that:
 *   1. Calls manager's phone (e.g. Sergey's +79013617775)
 *   2. When manager picks up — calls client phone
 *   3. Bridges + records both legs
 *   4. POSTs к /api/voximplant/webhook on Disconnected
 *
 * Auth: shared `X-Voximplant-Secret` header (same secret as inbound webhook —
 * CRM has it via env, browser does not). CRM-side endpoint adds the header
 * after verifying admin session.
 *
 * Body (JSON):
 *   {
 *     manager_phone: string (E.164, e.g. "+79013617775"),
 *     client_phone:  string (E.164),
 *     contact_id?:   string (CRM contact UUID, для логирования)
 *   }
 *
 * Returns: { ok: true, session_id, scenario_id, rule_id }
 *
 * Required env:
 *   VOXIMPLANT_SERVICE_ACCOUNT_BASE64
 *   VOXIMPLANT_WEBHOOK_SECRET (used as internal secret here too)
 *
 * Pre-req: outbound-callback scenario + outbound-callback-trigger rule
 * deployed via scripts/voximplant/create_outbound_callback_scenario.ts.
 */

type Creds = {
  account_email: string
  account_id: number
  key_id: string
  private_key: string
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function loadCreds(): Creds {
  const b64 = process.env.VOXIMPLANT_SERVICE_ACCOUNT_BASE64
  if (!b64) throw new Error('VOXIMPLANT_SERVICE_ACCOUNT_BASE64 not set')
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as Creds
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

async function voxApi(
  creds: Creds,
  cmd: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    body.set(k, String(v))
  }
  const res = await fetch(`https://api.voximplant.com/platform_api/${cmd}/`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(creds),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  return (await res.json()) as Record<string, unknown>
}

const E164 = /^\+\d{10,15}$/

export async function POST(req: NextRequest) {
  const secret = process.env.VOXIMPLANT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const provided = req.headers.get('x-voximplant-secret')
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { manager_phone?: string; client_phone?: string; contact_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const managerPhone = (body.manager_phone ?? '').trim()
  const clientPhone = (body.client_phone ?? '').trim()
  if (!E164.test(managerPhone) || !E164.test(clientPhone)) {
    return NextResponse.json(
      { error: 'manager_phone и client_phone must be E.164 (+7XXXXXXXXXX)' },
      { status: 400 },
    )
  }

  let creds: Creds
  try {
    creds = loadCreds()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'creds load failed' },
      { status: 500 },
    )
  }

  // Find outbound-callback rule + scenario by name (idempotent — fail if not deployed)
  const rulesResp = await voxApi(creds, 'GetRules', {
    application_name: 'metallportal-inbound',
    template: 'outbound-trigger-.*',
  })
  // Voximplant returns matching rule[s]
  const rules = (rulesResp.result as Array<{
    rule_id?: number
    rule_name?: string
  }>) ?? []
  const rule = rules.find((r) => r.rule_name === 'outbound-callback-trigger')
  if (!rule || !rule.rule_id) {
    return NextResponse.json(
      {
        error:
          'outbound-callback-trigger rule not found — run scripts/voximplant/create_outbound_callback_scenario.ts',
      },
      { status: 500 },
    )
  }

  // Fire StartScenarios — pass phones via custom_data
  const customData = JSON.stringify({
    manager_phone: managerPhone,
    client_phone: clientPhone,
    contact_id: body.contact_id ?? null,
  })

  const startResp = await voxApi(creds, 'StartScenarios', {
    rule_id: rule.rule_id,
    script_custom_data: customData,
    // user_id и application_id derived from rule's application
  })

  if (startResp.error) {
    const err = startResp.error as { code: number; msg: string }
    return NextResponse.json(
      { error: `Voximplant: ${err.code} ${err.msg}` },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    media_session_access_url:
      (startResp.media_session_access_url as string | undefined) ?? null,
    rule_id: rule.rule_id,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

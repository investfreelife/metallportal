import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/call (CRM proxy)
 *
 * Manager clicks «Call» в CRM contact detail. Browser POSTs here.
 * This endpoint:
 *   1. Verifies CRM admin session (owner / admin / manager / staff allowed).
 *   2. Forwards к main site `/api/voximplant/call` adding the shared
 *      `X-Voximplant-Secret` header (held server-side, never exposed
 *      к browser).
 *
 * Body:
 *   { client_phone: "+79XXXXXXXXX", contact_id?: string }
 *
 * Manager phone is configured server-side via env `OUTBOUND_MANAGER_PHONE`
 * (defaults to SERGEY_MOBILE_E164). Multi-manager support — phase 2 (per-
 * manager phone in admin_users + lookup by session.userId).
 */

const E164 = /^\+\d{10,15}$/

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin', 'manager', 'staff'])
  if (!auth.ok) return auth.error

  const secret = process.env.VOXIMPLANT_WEBHOOK_SECRET
  const mainSiteUrl =
    process.env.MAIN_SITE_URL ?? 'https://www.harlansteel.ru'
  const managerPhone =
    process.env.OUTBOUND_MANAGER_PHONE ?? process.env.SERGEY_MOBILE_E164 ?? ''

  if (!secret) {
    return NextResponse.json(
      { error: 'VOXIMPLANT_WEBHOOK_SECRET not set in CRM env' },
      { status: 500 },
    )
  }
  if (!E164.test(managerPhone)) {
    return NextResponse.json(
      { error: 'OUTBOUND_MANAGER_PHONE not configured' },
      { status: 500 },
    )
  }

  let body: { client_phone?: string; contact_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const clientPhone = (body.client_phone ?? '').trim()
  if (!E164.test(clientPhone)) {
    return NextResponse.json(
      { error: 'client_phone must be E.164 (+7XXXXXXXXXX)' },
      { status: 400 },
    )
  }

  const upstream = await fetch(`${mainSiteUrl}/api/voximplant/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Voximplant-Secret': secret,
    },
    body: JSON.stringify({
      manager_phone: managerPhone,
      client_phone: clientPhone,
      contact_id: body.contact_id ?? null,
    }),
  })

  const json = (await upstream.json()) as Record<string, unknown>
  if (!upstream.ok) {
    return NextResponse.json(
      { error: json.error ?? 'Upstream call failed', upstream_status: upstream.status },
      { status: upstream.status },
    )
  }

  return NextResponse.json({
    ok: true,
    manager_phone: managerPhone,
    client_phone: clientPhone,
    upstream: json,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

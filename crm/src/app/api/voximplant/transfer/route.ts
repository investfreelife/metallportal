import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/transfer (CRM proxy)
 *
 * Manager initiates mid-call transfer from CRM. Browser POSTs here.
 * 1. Verify CRM admin session.
 * 2. Resolve target phone (from manager_extensions.user_id или explicit
 *    phone в body).
 * 3. Resolve voximplant_session_id from `calls.id` (CRM gives call UUID).
 * 4. Forward к main site `/api/voximplant/transfer` с shared secret.
 *
 * Body:
 *   {
 *     call_id: string (calls.id UUID),
 *     transfer_to_user_id?: string (manager_extensions.user_id)
 *     transfer_to_phone?: string (E.164 fallback)
 *   }
 */

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'
const E164 = /^\+\d{10,15}$/

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin', 'manager', 'staff'])
  if (!auth.ok) return auth.error

  const secret = process.env.VOXIMPLANT_WEBHOOK_SECRET
  const mainSiteUrl = process.env.MAIN_SITE_URL ?? 'https://www.harlansteel.ru'
  if (!secret) {
    return NextResponse.json(
      { error: 'VOXIMPLANT_WEBHOOK_SECRET not set in CRM env' },
      { status: 500 },
    )
  }

  let body: { call_id?: string; transfer_to_user_id?: string; transfer_to_phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const callId = (body.call_id ?? '').trim()
  if (!callId) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 1. Resolve session_id from call row
  const { data: callRow } = await supabase
    .from('calls')
    .select('voximplant_session_id, status')
    .eq('id', callId)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle()

  const session = callRow as
    | { voximplant_session_id: string | null; status: string }
    | null

  if (!session?.voximplant_session_id) {
    return NextResponse.json(
      { error: 'Call session_id not found (call still active?)' },
      { status: 404 },
    )
  }

  // 2. Resolve target phone
  let targetPhone = (body.transfer_to_phone ?? '').trim()
  if (!targetPhone && body.transfer_to_user_id) {
    const { data: m } = await supabase
      .from('manager_extensions')
      .select('phone_e164, status')
      .eq('tenant_id', TENANT_ID)
      .eq('user_id', body.transfer_to_user_id)
      .maybeSingle()
    const ext = m as { phone_e164: string; status: string } | null
    if (!ext?.phone_e164) {
      return NextResponse.json(
        { error: 'Target manager has no phone configured' },
        { status: 400 },
      )
    }
    if (ext.status !== 'available') {
      return NextResponse.json(
        { error: `Target manager status: ${ext.status}` },
        { status: 409 },
      )
    }
    targetPhone = ext.phone_e164
  }

  if (!E164.test(targetPhone)) {
    return NextResponse.json(
      { error: 'Could not resolve target E.164 phone' },
      { status: 400 },
    )
  }

  // 3. Forward к main site (holds Voximplant SA creds)
  const upstream = await fetch(`${mainSiteUrl}/api/voximplant/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Voximplant-Secret': secret,
    },
    body: JSON.stringify({
      voximplant_session_id: session.voximplant_session_id,
      transfer_to_phone: targetPhone,
      transfer_to_user_id: body.transfer_to_user_id ?? null,
      // CrmSession не несёт userId — initiated_by кладём nullable
      initiated_by: null,
    }),
  })

  const json = (await upstream.json()) as Record<string, unknown>
  if (!upstream.ok) {
    return NextResponse.json(
      { error: json.error ?? 'Upstream transfer failed' },
      { status: upstream.status },
    )
  }

  return NextResponse.json({
    ok: true,
    transferred_to: targetPhone,
    upstream: json,
  })
}

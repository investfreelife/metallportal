import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/voximplant/route-incoming
 *
 * Called by Voximplant inbound scenario at the start of `CallEvents.CallAlerting`
 * — before forward — to determine WHICH manager phone to forward to.
 *
 * Routing precedence:
 *   1. Look up `contacts` by `from_number` (digit-normalised variants).
 *   2. If contact has `assigned_to` and that manager is `available` →
 *      forward to manager_extensions.phone_e164 (`assigned_manager`).
 *   3. If assigned manager is busy/offline → group fallback (per ТЗ §3
 *      placeholder; Phase 1 falls back к primary_fallback).
 *   4. Else → primary_fallback (`is_primary_fallback=true`) or hardcoded
 *      Sergey phone (`+79013617775`) — last-resort.
 *
 * Always logs decision к `call_routing_log` (audit + analytics).
 *
 * Body (JSON):
 *   {
 *     caller_phone: string (E.164 or digits-only — both accepted),
 *     voximplant_call_id?: string,
 *     voximplant_session_id?: string
 *   }
 *
 * Auth: shared `X-Voximplant-Secret` header (same secret as inbound webhook).
 *
 * Returns:
 *   {
 *     routed_to_phone: string (E.164 with `+`),
 *     contact: { id, full_name, company_name } | null,
 *     reason: routing_reason
 *   }
 */

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const SERGEY_FALLBACK_PHONE = '+79013617775'

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

type RoutingReason =
  | 'assigned_manager'
  | 'assigned_manager_busy_fallback'
  | 'group_round_robin'
  | 'group_parallel'
  | 'fallback_primary'
  | 'no_match_default'

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
    caller_phone?: string
    voximplant_call_id?: string
    voximplant_session_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const callerPhone = (body.caller_phone ?? '').trim()
  if (!callerPhone) {
    return NextResponse.json({ error: 'caller_phone required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // 1. Match contact by phone (digit variants)
  const digits = callerPhone.replace(/\D/g, '')
  type Contact = {
    id: string
    full_name: string | null
    company_name: string | null
    assigned_to: string | null
  }
  let contact: Contact | null = null
  if (digits) {
    const variants = [callerPhone, `+${digits}`, digits]
    const { data } = await sb
      .from('contacts')
      .select('id, full_name, company_name, assigned_to, phone')
      .eq('tenant_id', TENANT_ID)
      .in('phone', variants)
      .limit(1)
      .maybeSingle()
    if (data) contact = data as unknown as Contact
  }

  // 2. Decide routing
  let routedTo = ''
  let routedToUserId: string | null = null
  let reason: RoutingReason = 'no_match_default'

  if (contact?.assigned_to) {
    const { data: managerRow } = await sb
      .from('manager_extensions')
      .select('phone_e164, status, user_id')
      .eq('tenant_id', TENANT_ID)
      .eq('user_id', contact.assigned_to)
      .maybeSingle()
    const manager = managerRow as
      | { phone_e164: string; status: string; user_id: string }
      | null
    if (manager?.phone_e164) {
      if (manager.status === 'available') {
        routedTo = manager.phone_e164
        routedToUserId = manager.user_id
        reason = 'assigned_manager'
      } else {
        // Busy / offline — drop через fallback chain (group / primary)
        reason = 'assigned_manager_busy_fallback'
      }
    }
  }

  // 3. Group fallback (placeholder Phase 1 — default group is parallel,
  // которое в данной point releaseе означает — рoute к primary_fallback)
  // Phase 2: implement round-robin со next_round_robin_idx UPDATE.

  // 4. Final fallback к primary
  if (!routedTo) {
    const { data: primaryRow } = await sb
      .from('manager_extensions')
      .select('phone_e164, user_id')
      .eq('tenant_id', TENANT_ID)
      .eq('is_primary_fallback', true)
      .maybeSingle()
    const primary = primaryRow as { phone_e164: string; user_id: string | null } | null
    if (primary?.phone_e164) {
      routedTo = primary.phone_e164
      routedToUserId = primary.user_id
      if (reason === 'no_match_default') reason = 'fallback_primary'
      // Don't overwrite assigned_manager_busy_fallback reason
    } else {
      // Last resort — hardcoded
      routedTo = SERGEY_FALLBACK_PHONE
    }
  }

  // 5. Audit log
  await sb.from('call_routing_log').insert({
    tenant_id: TENANT_ID,
    voximplant_call_id: body.voximplant_call_id ?? null,
    voximplant_session_id: body.voximplant_session_id ?? null,
    caller_phone: callerPhone,
    matched_contact_id: contact?.id ?? null,
    routed_to_user_id: routedToUserId,
    routed_to_phone: routedTo,
    routing_reason: reason,
  })

  return NextResponse.json({
    routed_to_phone: routedTo,
    contact: contact
      ? {
          id: contact.id,
          full_name: contact.full_name,
          company_name: contact.company_name,
        }
      : null,
    reason,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

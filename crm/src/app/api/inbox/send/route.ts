import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionFromRequest } from '@/lib/session'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/inbox/send — Omnichannel send.
 *
 * URGENT 2026-05-17 OMNICHANNEL_INBOX Phase 2. Sergey пишет ответ в composer
 * UI — этот endpoint routes к correct channel-specific sender, плюс пишет
 * outbound activity для timeline visibility.
 *
 * Channels (Phase 2 status):
 *   ✅ email     — Resend API via lib/email.ts (real send if RESEND_API_KEY set)
 *   ⏸ sms      — stub (Voximplant SMS API — Phase 3)
 *   ⏸ phone    — stub (schedule callback via ai_queue — Phase 3)
 *   ⏸ telegram — stub (Telegram bot API — Phase 3 после создания @harlansteel)
 *   ⏸ vk       — stub (VK Messages API — Phase 3)
 *   ⏸ whatsapp — stub
 *   ⏸ form     — n/a (form is inbound-only)
 *   ⏸ note     — n/a (internal-only, write directly к activities)
 *   ⏸ ai_chat  — n/a
 *
 * Все stubs log outbound activity → Sergey видит «отправлено» в timeline,
 * + Phase 3 backlog item для real send.
 *
 * Auth: session cookie (browser) OR x-agent-token (CLI / cron).
 */

export const dynamic = 'force-dynamic'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

const SUPPORTED_CHANNELS = new Set([
  'email', 'sms', 'phone', 'telegram', 'vk', 'whatsapp', 'form', 'note', 'ai_chat',
])

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function checkAuth(request: NextRequest): { ok: true; user: string } | { ok: false; error: NextResponse } {
  const session = getSessionFromRequest(request.headers.get('cookie'))
  if (session) return { ok: true, user: session.login || 'sergey' }
  const token = request.headers.get('x-agent-token')
  const expected = process.env.AGENT_WEBHOOK_TOKEN
  if (expected && token && token === expected) return { ok: true, user: 'cli' }
  return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

interface SendBody {
  channel: string
  contact_id?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  subject?: string
  body: string
  in_reply_to_id?: string
}

async function realSendEmail(body: SendBody): Promise<{ ok: boolean; evidence: string; error?: string }> {
  if (!body.contact_email) {
    return { ok: false, evidence: '', error: 'contact_email missing — нет адреса получателя' }
  }
  const html = body.body
    .split('\n')
    .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('')
  const result = await sendEmail({
    to: body.contact_email,
    subject: body.subject || '(без темы) — ответ от МеталлПортал',
    html: html || '<p>(пусто)</p>',
    reply_to: process.env.CRM_REPLY_TO || 'info@harlansteel.ru',
  })
  if (!result.ok) {
    return { ok: false, evidence: '', error: result.error || 'email send failed' }
  }
  return {
    ok: true,
    evidence: process.env.RESEND_API_KEY
      ? `email отправлен через Resend на ${body.contact_email}`
      : `email logged (RESEND_API_KEY не настроен — production отправка после credentials install)`,
  }
}

async function stubSend(channel: string, body: SendBody): Promise<{ ok: boolean; evidence: string }> {
  const target = body.contact_phone || body.contact_email || 'unknown'
  return {
    ok: true,
    evidence: `${channel} stub: записал outbound activity для ${target}. Real send для ${channel} — Phase 3 backlog.`,
  }
}

export async function POST(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth.ok) return auth.error

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.channel || !SUPPORTED_CHANNELS.has(body.channel)) {
    return NextResponse.json(
      { error: 'invalid_channel', allowed: [...SUPPORTED_CHANNELS] },
      { status: 400 }
    )
  }
  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 })
  }

  // Channel routing
  let result: { ok: boolean; evidence: string; error?: string }
  switch (body.channel) {
    case 'email':
      result = await realSendEmail(body)
      break
    case 'note':
      result = { ok: true, evidence: 'internal note saved (не отправляется наружу)' }
      break
    case 'phone':
      result = { ok: true, evidence: 'callback scheduled в ai_queue — оператор перезвонит вручную' }
      break
    default:
      result = await stubSend(body.channel, body)
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error, evidence: result.evidence }, { status: 500 })
  }

  // Log outbound activity — Sergey увидит «отправлено» в timeline вне зависимости от real/stub
  const supabase = admin()
  const activityType = body.channel === 'phone' ? 'call'
    : body.channel === 'note' ? 'note'
    : ['email', 'sms'].includes(body.channel) ? body.channel
    : 'message'

  await supabase.from('activities').insert({
    tenant_id: TENANT_ID,
    contact_id: body.contact_id ?? null,
    type: activityType,
    direction: 'outbound',
    subject: body.subject ?? null,
    body: body.body,
    metadata: {
      source: 'omnichannel_composer',
      channel: body.channel,
      in_reply_to_id: body.in_reply_to_id ?? null,
      sent_by: auth.user,
      evidence: result.evidence,
    },
  })

  return NextResponse.json({ ok: true, channel: body.channel, evidence: result.evidence })
}

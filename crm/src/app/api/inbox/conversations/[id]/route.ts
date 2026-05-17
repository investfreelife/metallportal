import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/inbox/conversations/[id]
 *
 * Returns full thread (all messages) for a conversation. `id` format:
 *   "c:{contact_id}"             — group by contact
 *   "{channel}:{sender_address}" — anonymous
 *
 * Same aggregation pattern as list endpoint, но включает body + attachments.
 */

export const dynamic = 'force-dynamic'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)
  const supabase = admin()

  let contactId: string | null = null
  let senderAddress: string | null = null
  let channel: string | null = null

  if (decodedId.startsWith('c:')) {
    contactId = decodedId.slice(2)
  } else {
    const sep = decodedId.indexOf(':')
    if (sep > 0) {
      channel = decodedId.slice(0, sep)
      senderAddress = decodedId.slice(sep + 1)
    }
  }

  const promises: any[] = []

  // Activities
  let actQ = supabase
    .from('activities')
    .select('id, type, subject, body, direction, created_at, metadata, sender_name, sender_address, channel, contact_id, is_internal, attachments, contact:contacts(id, full_name, phone, email, company_name, ai_score, ai_segment, source)')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: true })
    .limit(200)
  if (contactId) actQ = actQ.eq('contact_id', contactId)
  else if (senderAddress) actQ = actQ.eq('sender_address', senderAddress)
  promises.push(actQ)

  // Emails
  let emQ = supabase
    .from('emails')
    .select('id, subject, body_text, body_html, direction, is_read, received_at, sent_at, created_at, from_email, from_name, to_emails, attachments, contact_id, contact:contacts(id, full_name, email, company_name, ai_score, ai_segment)')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: true })
    .limit(200)
  if (contactId) emQ = emQ.eq('contact_id', contactId)
  else if (senderAddress && channel === 'email') emQ = emQ.eq('from_email', senderAddress)
  promises.push(emQ)

  // Messages (Telegram) — only if no contact_id (link by phone) or channel=telegram
  if (channel === 'telegram' || !contactId) {
    promises.push(
      supabase
        .from('messages')
        .select('id, sender_type, content, created_at, is_read, chat_id, chat:chats(id, telegram_username, customer_name, customer_phone)')
        .order('created_at', { ascending: true })
        .limit(200)
    )
  } else {
    promises.push(Promise.resolve({ data: [] }))
  }

  const [actRes, emRes, msgRes] = await Promise.all(promises)
  const activities = actRes.data || []
  const emails = emRes.data || []
  const tgMessages = msgRes.data || []

  // Filter TG messages by sender_address if it's a phone (chat.customer_phone)
  const filteredTg = !contactId && senderAddress && channel === 'telegram'
    ? tgMessages.filter((m: any) => {
        const chat = Array.isArray(m.chat) ? m.chat[0] : m.chat
        return chat?.customer_phone === senderAddress
          || chat?.telegram_username === senderAddress
          || chat?.customer_name === senderAddress
      })
    : []

  // Normalize to messages
  const messages: any[] = []
  let contact: any = null

  for (const a of activities) {
    const c = Array.isArray(a.contact) ? a.contact[0] : a.contact
    if (c && !contact) contact = c
    messages.push({
      id: `activity:${a.id}`,
      channel: a.channel || a.type,
      direction: a.direction === 'outbound' ? 'outbound' : 'inbound',
      sender_name: a.sender_name || c?.full_name || null,
      sender_address: a.sender_address || c?.phone || null,
      subject: a.subject ?? null,
      body: a.body || '',
      is_internal: !!a.is_internal,
      attachments: a.attachments || [],
      created_at: a.created_at,
      source_table: 'activities',
      source_id: a.id,
    })
  }

  for (const e of emails) {
    const c = Array.isArray(e.contact) ? e.contact[0] : e.contact
    if (c && !contact) contact = c
    const body = e.body_text || (e.body_html || '').replace(/<[^>]+>/g, '').trim()
    messages.push({
      id: `email:${e.id}`,
      channel: 'email',
      direction: e.direction === 'outbound' ? 'outbound' : 'inbound',
      sender_name: e.from_name || c?.full_name || null,
      sender_address: e.from_email || c?.email || null,
      subject: e.subject ?? null,
      body,
      is_internal: false,
      attachments: e.attachments || [],
      created_at: e.created_at || e.received_at || e.sent_at,
      source_table: 'emails',
      source_id: e.id,
    })
  }

  for (const m of filteredTg.length ? filteredTg : tgMessages) {
    const chat = Array.isArray(m.chat) ? m.chat[0] : m.chat
    const isInbound = m.sender_type === 'customer'
    messages.push({
      id: `message:${m.id}`,
      channel: 'telegram',
      direction: isInbound ? 'inbound' : 'outbound',
      sender_name: isInbound ? chat?.customer_name || chat?.telegram_username || 'Telegram user' : 'Менеджер',
      sender_address: chat?.customer_phone || chat?.telegram_username || null,
      subject: null,
      body: m.content || '',
      is_internal: false,
      attachments: [],
      created_at: m.created_at,
      source_table: 'messages',
      source_id: m.id,
    })
  }

  messages.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  return NextResponse.json(
    {
      conversation: {
        id: decodedId,
        contact,
        message_count: messages.length,
        channel: messages[messages.length - 1]?.channel || channel || 'unknown',
        subject: messages[0]?.subject || null,
      },
      messages,
    },
    { headers: { 'cache-control': 'no-store' } }
  )
}

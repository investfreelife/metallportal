import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/inbox/conversations
 *
 * Aggregate messages from 3 sources into virtual conversations grouped by contact:
 *   - activities (calls / messages / notes / form)
 *   - emails (Yandex 360 IMAP + Resend)
 *   - messages (Telegram via chats)
 *
 * Phase 1 design: до backfill в conversations table, делаем aggregation
 * on-the-fly. Каждая «conversation» = группировка по contact_id (если есть)
 * или по channel+sender (если no contact). Возвращаем merged list с metadata
 * для UI: last_message_at / preview / channel / unread_count / priority.
 *
 * Query params:
 *   ?view = open / hot / unread / snoozed / closed / spam (default = open)
 *   ?channel = email/phone/sms/telegram/vk/whatsapp/form/note (default = all)
 *   ?search = full-text search (contact name, subject, body)
 *   ?limit = default 100
 *
 * Auth: session cookie OR x-agent-token (PUBLIC_PREFIX /api/inbox/).
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

function activityToChannel(type: string, metadata: any): string {
  if (type === 'call') return 'phone'
  if (type === 'email') return 'email'
  if (type === 'sms') return 'sms'
  if (type === 'note') return 'note'
  if (type === 'message') {
    const source = String(metadata?.source || metadata?.channel || '').toLowerCase()
    if (['telegram', 'tg'].includes(source)) return 'telegram'
    if (['vk', 'vkontakte'].includes(source)) return 'vk'
    if (source === 'whatsapp') return 'whatsapp'
    if (source === 'sms') return 'sms'
    return 'form'
  }
  return 'form'
}

interface Message {
  id: string
  channel: string
  direction: 'inbound' | 'outbound'
  contact_id: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  subject: string | null
  body: string
  preview: string
  created_at: string
  is_read: boolean
  ai_priority: string | null
  ai_score: number | null
  ai_segment: string | null
  source_table: string
  source_id: string
}

interface ConversationCard {
  id: string                        // composite "{channel}:{contact_id}" or "{channel}:{sender_address}"
  contact_id: string | null
  contact_name: string
  contact_phone: string | null
  contact_email: string | null
  contact_company: string | null
  channel: string
  subject: string | null
  last_message_preview: string
  last_message_at: string
  last_message_direction: 'inbound' | 'outbound'
  unread_count: number
  message_count: number
  priority: 'urgent' | 'hot' | 'normal' | 'low'
  status: 'open' | 'pending' | 'closed' | 'snoozed' | 'spam'
  tags: string[]
  ai_score: number | null
  ai_segment: string | null
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const view = url.searchParams.get('view') ?? 'open'
  const channelFilter = url.searchParams.get('channel')
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 300)

  const supabase = admin()

  const [
    { data: activities },
    { data: emails },
    { data: tgMessages },
  ] = await Promise.all([
    supabase
      .from('activities')
      .select('id, type, subject, body, direction, created_at, metadata, sender_name, sender_address, channel, contact:contacts(id, full_name, phone, email, company_name, ai_score, ai_segment)')
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('emails')
      .select('id, subject, body_text, body_html, direction, is_read, received_at, sent_at, created_at, from_email, from_name, to_emails, contact_id, contact:contacts(id, full_name, email, company_name, ai_score, ai_segment)')
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('messages')
      .select('id, sender_type, content, created_at, is_read, chat:chats(id, telegram_username, customer_name, customer_phone)')
      .order('created_at', { ascending: false })
      .limit(150),
  ])

  // Normalize all to flat Message[] list
  const messages: Message[] = []

  for (const a of (activities || []) as any[]) {
    const contact = Array.isArray(a.contact) ? a.contact[0] : a.contact
    const channel = a.channel || activityToChannel(a.type, a.metadata)
    const body = a.body || a.subject || ''
    const priority = a.metadata?.ai_priority ?? null
    messages.push({
      id: `activity:${a.id}`,
      channel,
      direction: (a.direction === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound',
      contact_id: contact?.id ?? null,
      contact_name: a.sender_name || contact?.full_name || null,
      contact_phone: a.sender_address || contact?.phone || null,
      contact_email: contact?.email || null,
      subject: a.subject ?? null,
      body,
      preview: body.slice(0, 140),
      created_at: a.created_at,
      is_read: true,
      ai_priority: priority,
      ai_score: contact?.ai_score ?? null,
      ai_segment: contact?.ai_segment ?? null,
      source_table: 'activities',
      source_id: a.id,
    })
  }

  for (const e of (emails || []) as any[]) {
    const contact = Array.isArray(e.contact) ? e.contact[0] : e.contact
    const body = (e.body_text || e.body_html || '').replace(/<[^>]+>/g, '').trim()
    messages.push({
      id: `email:${e.id}`,
      channel: 'email',
      direction: (e.direction === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound',
      contact_id: contact?.id ?? null,
      contact_name: e.from_name || contact?.full_name || e.from_email || null,
      contact_phone: null,
      contact_email: contact?.email || e.from_email || null,
      subject: e.subject ?? null,
      body,
      preview: body.slice(0, 140),
      created_at: e.created_at || e.received_at || e.sent_at,
      is_read: !!e.is_read,
      ai_priority: null,
      ai_score: contact?.ai_score ?? null,
      ai_segment: contact?.ai_segment ?? null,
      source_table: 'emails',
      source_id: e.id,
    })
  }

  for (const m of (tgMessages || []) as any[]) {
    const chat = Array.isArray(m.chat) ? m.chat[0] : m.chat
    const isInbound = m.sender_type === 'customer'
    messages.push({
      id: `message:${m.id}`,
      channel: 'telegram',
      direction: (isInbound ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
      contact_id: null,
      contact_name: isInbound ? chat?.customer_name || chat?.telegram_username || 'Telegram' : 'Менеджер',
      contact_phone: chat?.customer_phone || null,
      contact_email: null,
      subject: null,
      body: m.content || '',
      preview: (m.content || '').slice(0, 140),
      created_at: m.created_at,
      is_read: !!m.is_read,
      ai_priority: null,
      ai_score: null,
      ai_segment: null,
      source_table: 'messages',
      source_id: m.id,
    })
  }

  // Group by conversation key (contact_id OR channel+sender_phone OR channel+sender_email)
  const conversationMap = new Map<string, ConversationCard & { _messages: Message[] }>()

  for (const m of messages) {
    const conversationKey =
      m.contact_id
        ? `c:${m.contact_id}`
        : `${m.channel}:${m.contact_phone || m.contact_email || m.contact_name || 'anon'}`

    if (!conversationMap.has(conversationKey)) {
      const aiPriority = (m.ai_priority as ConversationCard['priority']) ||
        ((m.ai_score ?? 0) >= 80 ? 'urgent' : (m.ai_score ?? 0) >= 60 ? 'hot' : 'normal')
      conversationMap.set(conversationKey, {
        id: conversationKey,
        contact_id: m.contact_id,
        contact_name: m.contact_name || 'Аноним',
        contact_phone: m.contact_phone,
        contact_email: m.contact_email,
        contact_company: null,
        channel: m.channel,
        subject: m.subject,
        last_message_preview: m.preview,
        last_message_at: m.created_at,
        last_message_direction: m.direction,
        unread_count: 0,
        message_count: 0,
        priority: aiPriority,
        status: 'open',
        tags: [],
        ai_score: m.ai_score,
        ai_segment: m.ai_segment,
        _messages: [],
      })
    }
    const conv = conversationMap.get(conversationKey)!
    conv._messages.push(m)
    conv.message_count += 1
    if (!m.is_read && m.direction === 'inbound') conv.unread_count += 1
    if (m.created_at > conv.last_message_at) {
      conv.last_message_at = m.created_at
      conv.last_message_preview = m.preview
      conv.last_message_direction = m.direction
      if (m.subject) conv.subject = m.subject
      conv.channel = m.channel
    }
    if (m.ai_score !== null && (conv.ai_score === null || m.ai_score > conv.ai_score)) {
      conv.ai_score = m.ai_score
    }
    if (!conv.contact_name || conv.contact_name === 'Аноним') {
      conv.contact_name = m.contact_name || conv.contact_name
    }
  }

  let conversations = Array.from(conversationMap.values())

  // View filters
  if (view === 'hot') conversations = conversations.filter((c) => ['urgent', 'hot'].includes(c.priority))
  if (view === 'unread') conversations = conversations.filter((c) => c.unread_count > 0)
  // snoozed/closed/spam — TODO Phase 2 (требует conversations table)

  if (channelFilter && channelFilter !== 'all') {
    conversations = conversations.filter((c) => c.channel === channelFilter)
  }

  if (search) {
    conversations = conversations.filter((c) => {
      const hay = `${c.contact_name} ${c.subject || ''} ${c.last_message_preview} ${c.contact_phone || ''} ${c.contact_email || ''}`.toLowerCase()
      return hay.includes(search)
    })
  }

  conversations.sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))
  conversations = conversations.slice(0, limit)

  // Channel counts (for sidebar badges) — based on full set, not filtered
  const channelCounts: Record<string, number> = {}
  for (const c of conversationMap.values()) {
    channelCounts[c.channel] = (channelCounts[c.channel] ?? 0) + 1
  }
  const viewCounts = {
    open: conversationMap.size,
    hot: Array.from(conversationMap.values()).filter((c) => ['urgent', 'hot'].includes(c.priority)).length,
    unread: Array.from(conversationMap.values()).filter((c) => c.unread_count > 0).length,
    snoozed: 0,
    closed: 0,
    spam: 0,
  }

  // Strip internal _messages from response — list view doesn't need bodies
  const responseConversations = conversations.map((c) => {
    const { _messages, ...rest } = c
    return rest
  })

  return NextResponse.json({
    conversations: responseConversations,
    total_count: conversationMap.size,
    channel_counts: channelCounts,
    view_counts: viewCounts,
  }, { headers: { 'cache-control': 'no-store' } })
}

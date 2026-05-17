'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * OmnichannelInbox — Section «💬 Все сообщения (омниchannel)».
 *
 * URGENT 2026-05-17 Sergey directive «нет внутреннего чата где все каналы
 * агрегируются — где в одном окне можно ответить в любой канал». Этот компонент
 * собирает данные из 3 tables (Phase 1) и показывает в едином timeline:
 *   - activities (calls / messages / notes / форма) → разные channels по type+metadata
 *   - emails (Yandex 360 IMAP poll OR Resend bounce) → email channel
 *   - messages (Telegram chats joined) → telegram channel
 *
 * Realtime: postgres_changes INSERTs на activities + emails + messages reload feed.
 *
 * Phase 1 deliverable: aggregate + filter + search + thread view + composer.
 * Phase 2 (separate commit): /api/inbox/send real implementations для email + SMS.
 * Phase 3 multi-day: webhooks от Voximplant / Yandex 360 / Telegram bot / VK.
 */

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

type Channel = 'phone' | 'sms' | 'email' | 'form' | 'telegram' | 'vk' | 'whatsapp' | 'note' | 'ai_chat'

const CHANNEL_META: Record<Channel, { icon: string; label: string; color: string }> = {
  phone:    { icon: '📞', label: 'Звонок',    color: 'bg-green-100 text-green-700' },
  sms:      { icon: '💬', label: 'SMS',       color: 'bg-emerald-100 text-emerald-700' },
  email:    { icon: '📧', label: 'Email',     color: 'bg-blue-100 text-blue-700' },
  form:     { icon: '📝', label: 'Форма',     color: 'bg-purple-100 text-purple-700' },
  telegram: { icon: '✈️', label: 'Telegram',  color: 'bg-sky-100 text-sky-700' },
  vk:       { icon: '🅰️', label: 'VK',        color: 'bg-indigo-100 text-indigo-700' },
  whatsapp: { icon: '🟢', label: 'WhatsApp',  color: 'bg-green-100 text-green-700' },
  note:     { icon: '🗒', label: 'Заметка',   color: 'bg-amber-100 text-amber-700' },
  ai_chat:  { icon: '🤖', label: 'AI чат',    color: 'bg-gray-100 text-gray-700' },
}

interface Message {
  id: string // composite "{table}:{id}"
  channel: Channel
  direction: 'inbound' | 'outbound'
  contact_id: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  subject: string | null
  preview: string
  body: string
  created_at: string
  is_read: boolean
  ai_priority: 'urgent' | 'hot' | 'normal' | 'low' | null
  source_table: string
  source_id: string
}

function activityTypeToChannel(type: string, metadata: any): Channel {
  if (type === 'call') return 'phone'
  if (type === 'email') return 'email'
  if (type === 'sms') return 'sms'
  if (type === 'note') return 'note'
  if (type === 'message') {
    const source = (metadata?.source || metadata?.channel || '').toLowerCase()
    if (source === 'telegram' || source === 'tg') return 'telegram'
    if (source === 'vk' || source === 'vkontakte') return 'vk'
    if (source === 'whatsapp') return 'whatsapp'
    if (source === 'sms') return 'sms'
    return 'form'
  }
  return 'form'
}

export function OmnichannelInbox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [filterChannel, setFilterChannel] = useState<Channel | 'all'>('all')
  const [filterDirection, setFilterDirection] = useState<'all' | 'inbound' | 'outbound' | 'unread'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)

  async function loadMessages() {
    const supabase = createClient()
    setError(null)
    try {
      const [
        { data: activities, error: actErr },
        { data: emails, error: emErr },
        { data: tgMessages, error: msgErr },
      ] = await Promise.all([
        supabase
          .from('activities')
          .select('id, type, subject, body, direction, created_at, metadata, contact:contacts(id, full_name, phone, email)')
          .eq('tenant_id', TENANT_ID)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('emails')
          .select('id, subject, body_text, body_html, direction, is_read, received_at, sent_at, created_at, from_email, from_name, to_emails, contact_id, contact:contacts(id, full_name, email)')
          .eq('tenant_id', TENANT_ID)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('messages')
          .select('id, sender_type, content, created_at, is_read, chat:chats(id, telegram_username, customer_name, customer_phone)')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (actErr || emErr || msgErr) {
        const errMsg = [actErr?.message, emErr?.message, msgErr?.message].filter(Boolean).join('; ')
        if (errMsg) setError(errMsg)
      }

      const merged: Message[] = []

      ;(activities || []).forEach((a: any) => {
        const contact = Array.isArray(a.contact) ? a.contact[0] : a.contact
        const channel = activityTypeToChannel(a.type, a.metadata)
        const priority = a.metadata?.ai_priority ?? null
        merged.push({
          id: `activity:${a.id}`,
          channel,
          direction: (a.direction === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound',
          contact_id: contact?.id ?? null,
          contact_name: contact?.full_name ?? null,
          contact_phone: contact?.phone ?? null,
          contact_email: contact?.email ?? null,
          subject: a.subject ?? null,
          preview: ((a.body || a.subject || '') as string).slice(0, 100),
          body: a.body || '',
          created_at: a.created_at,
          is_read: true,
          ai_priority: priority,
          source_table: 'activities',
          source_id: a.id,
        })
      })

      ;(emails || []).forEach((e: any) => {
        const contact = Array.isArray(e.contact) ? e.contact[0] : e.contact
        const body = (e.body_text || e.body_html || '').replace(/<[^>]+>/g, '').trim()
        const senderName = e.from_name || contact?.full_name || e.from_email || 'Email'
        merged.push({
          id: `email:${e.id}`,
          channel: 'email',
          direction: (e.direction === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound',
          contact_id: contact?.id ?? null,
          contact_name: senderName,
          contact_phone: null,
          contact_email: contact?.email ?? e.from_email ?? null,
          subject: e.subject ?? null,
          preview: body.slice(0, 100),
          body: body || '',
          created_at: e.created_at || e.received_at || e.sent_at,
          is_read: !!e.is_read,
          ai_priority: null,
          source_table: 'emails',
          source_id: e.id,
        })
      })

      ;(tgMessages || []).forEach((m: any) => {
        const chat = Array.isArray(m.chat) ? m.chat[0] : m.chat
        const senderName = m.sender_type === 'customer'
          ? (chat?.customer_name || chat?.telegram_username || 'Telegram user')
          : (m.sender_type === 'manager' ? 'Менеджер' : m.sender_type === 'ai' ? 'AI бот' : 'Telegram')
        merged.push({
          id: `message:${m.id}`,
          channel: 'telegram',
          direction: (m.sender_type === 'customer' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
          contact_id: null,
          contact_name: senderName,
          contact_phone: chat?.customer_phone ?? null,
          contact_email: null,
          subject: null,
          preview: (m.content || '').slice(0, 100),
          body: m.content || '',
          created_at: m.created_at,
          is_read: !!m.is_read,
          ai_priority: null,
          source_table: 'messages',
          source_id: m.id,
        })
      })

      merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      setMessages(merged)
    } catch (e: any) {
      setError(e?.message ?? 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()

    const supabase = createClient()
    const channel = supabase
      .channel('omnichannel_realtime')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'activities' }, loadMessages)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'emails' }, loadMessages)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'messages' }, loadMessages)
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setConnected(true)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (filterChannel !== 'all' && m.channel !== filterChannel) return false
      if (filterDirection === 'inbound' && m.direction !== 'inbound') return false
      if (filterDirection === 'outbound' && m.direction !== 'outbound') return false
      if (filterDirection === 'unread' && (m.is_read || m.direction !== 'inbound')) return false
      if (search) {
        const needle = search.toLowerCase()
        const hay = `${m.contact_name || ''} ${m.subject || ''} ${m.preview} ${m.contact_phone || ''} ${m.contact_email || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [messages, filterChannel, filterDirection, search])

  const unreadCount = useMemo(
    () => messages.filter((m) => !m.is_read && m.direction === 'inbound').length,
    [messages]
  )

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              💬 Все сообщения
              {unreadCount > 0 && (
                <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} новых
                </span>
              )}
              <span
                className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
                title={connected ? 'Realtime подключён' : 'Realtime отключён'}
              />
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Звонки · email · форма · Telegram · SMS — всё в одном окне. {messages.length} сообщений.
            </p>
          </div>
          <input
            type="search"
            placeholder="Поиск по имени / теме / телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded text-[12px] w-56 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter row — channel + direction */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 overflow-x-auto">
        <FilterButton active={filterChannel === 'all'} onClick={() => setFilterChannel('all')} label="Все" count={messages.length} />
        {Object.entries(CHANNEL_META).map(([k, meta]) => {
          const count = messages.filter((m) => m.channel === k).length
          if (count === 0 && filterChannel !== k) return null // hide empty channels
          return (
            <FilterButton
              key={k}
              active={filterChannel === k}
              onClick={() => setFilterChannel(k as Channel)}
              label={`${meta.icon} ${meta.label}`}
              count={count}
            />
          )
        })}
        <div className="border-l border-gray-300 h-5 mx-1"></div>
        <FilterButton active={filterDirection === 'unread'} onClick={() => setFilterDirection(filterDirection === 'unread' ? 'all' : 'unread')} label={`📬 Непрочитанные`} count={unreadCount} compact />
        <FilterButton active={filterDirection === 'inbound'} onClick={() => setFilterDirection(filterDirection === 'inbound' ? 'all' : 'inbound')} label="↘ Входящие" compact />
        <FilterButton active={filterDirection === 'outbound'} onClick={() => setFilterDirection(filterDirection === 'outbound' ? 'all' : 'outbound')} label="↗ Исходящие" compact />
      </div>

      <div className="flex h-[36rem]">
        {/* Message list */}
        <div className="w-2/5 border-r border-gray-100 overflow-y-auto">
          {loading && <div className="p-4 text-[12px] text-gray-400">Загружаю сообщения...</div>}
          {error && <div className="p-4 text-[12px] text-red-600 bg-red-50">{error}</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-4 text-[12px] text-gray-400 italic">
              Нет сообщений с фильтром. Сбрось фильтр или попробуй другой канал.
            </div>
          )}
          {filtered.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              selected={selected?.id === msg.id}
              onSelect={() => {
                setSelected(msg)
                setAiSuggestion(null)
              }}
            />
          ))}
        </div>

        {/* Thread view */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <ThreadView
              message={selected}
              aiSuggestion={aiSuggestion}
              onAISuggest={(suggestion) => setAiSuggestion(suggestion)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400 p-6 text-center">
              Выбери сообщение слева — увидишь полный текст + composer для ответа в любой канал.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function FilterButton({
  active,
  onClick,
  label,
  count,
  compact = false,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 ${compact ? 'px-2 py-1' : 'px-2.5 py-1'} text-[11px] rounded-full whitespace-nowrap transition-colors ${
        active
          ? 'bg-blue-600 text-white border border-blue-600'
          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
      {typeof count === 'number' && <span className="opacity-60 ml-1">({count})</span>}
    </button>
  )
}

function timeFmt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function MessageRow({ message, selected, onSelect }: { message: Message; selected: boolean; onSelect: () => void }) {
  const meta = CHANNEL_META[message.channel]
  const isUnread = !message.is_read && message.direction === 'inbound'

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
        selected ? 'bg-blue-50/60 border-l-2 border-l-blue-500' : ''
      } ${isUnread ? 'bg-amber-50/30' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.color} font-medium`}>
          {meta.icon} {meta.label}
        </span>
        {message.direction === 'outbound' && (
          <span className="text-[10px] text-gray-400">↗ исходящее</span>
        )}
        {isUnread && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" title="непрочитано" />}
        {message.ai_priority === 'urgent' && (
          <span className="text-[10px] text-red-600 font-bold">🔥 СРОЧНО</span>
        )}
        {message.ai_priority === 'hot' && <span className="text-[10px] text-orange-600">🔥 hot</span>}
        <span className="text-[10px] text-gray-400 ml-auto">{timeFmt(message.created_at)}</span>
      </div>
      <div className={`text-[12px] ${isUnread ? 'font-semibold' : 'font-medium'} text-gray-900 truncate`}>
        {message.contact_name || 'Аноним'}
      </div>
      <div className="text-[11px] text-gray-500 truncate">
        {message.subject && <span className="font-medium">{message.subject}: </span>}
        {message.preview || <span className="italic">(пусто)</span>}
      </div>
    </button>
  )
}

function ThreadView({
  message,
  aiSuggestion,
  onAISuggest,
}: {
  message: Message
  aiSuggestion: string | null
  onAISuggest: (text: string | null) => void
}) {
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [targetChannel, setTargetChannel] = useState<Channel>(message.channel)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Reset composer when selection changes
  useEffect(() => {
    setReply('')
    setSendResult(null)
    setTargetChannel(message.channel)
  }, [message.id])

  const meta = CHANNEL_META[message.channel]
  const targetMeta = CHANNEL_META[targetChannel]

  async function send() {
    if (!reply.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: targetChannel,
          contact_id: message.contact_id,
          contact_phone: message.contact_phone,
          contact_email: message.contact_email,
          subject: message.subject ? `Re: ${message.subject}` : undefined,
          body: reply,
          in_reply_to_id: message.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSendResult(`✓ ${data.evidence || 'отправлено'}`)
        setReply('')
      } else {
        setSendResult(`✗ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch (e: any) {
      setSendResult(`✗ ${e?.message || 'network error'}`)
    } finally {
      setSending(false)
    }
  }

  async function aiSuggest() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/inbox/ai-suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: message.channel,
          contact_name: message.contact_name,
          subject: message.subject,
          body: message.body,
        }),
      })
      const data = await res.json()
      if (res.ok && data.suggestion) {
        onAISuggest(data.suggestion)
        setReply(data.suggestion)
      } else {
        onAISuggest(`(AI suggest недоступен: ${data.error || 'нет endpoint'})`)
      }
    } catch (e: any) {
      onAISuggest(`(AI suggest error: ${e?.message})`)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <>
      {/* Thread header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.color} font-medium`}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-[13px] font-semibold text-gray-900">
            {message.contact_name || 'Аноним'}
          </span>
          {message.contact_phone && (
            <a
              href={`tel:${message.contact_phone}`}
              className="text-[11px] text-blue-600 hover:underline"
            >
              {message.contact_phone}
            </a>
          )}
          {message.contact_email && (
            <a
              href={`mailto:${message.contact_email}`}
              className="text-[11px] text-blue-600 hover:underline"
            >
              {message.contact_email}
            </a>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">
            {timeFmt(message.created_at)} · {message.direction === 'inbound' ? 'входящее' : 'исходящее'}
          </span>
        </div>
        {message.subject && (
          <div className="text-[12px] font-medium mt-1 text-gray-900">{message.subject}</div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        <div className="whitespace-pre-wrap text-[13px] text-gray-800 leading-relaxed">
          {message.body || <span className="italic text-gray-400">(пустое сообщение)</span>}
        </div>
        {message.contact_id && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
            Полная история контакта · <a href={`/contacts/${message.contact_id}`} className="text-blue-600 hover:underline">открыть карточку →</a>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 p-3 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap text-[11px]">
          <label className="text-gray-500">Канал ответа:</label>
          <select
            value={targetChannel}
            onChange={(e) => setTargetChannel(e.target.value as Channel)}
            className="border border-gray-200 rounded px-2 py-1 text-[12px] bg-white"
          >
            {Object.entries(CHANNEL_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={aiSuggest}
            disabled={aiLoading}
            className="text-purple-600 hover:text-purple-800 ml-auto disabled:opacity-50"
            title="AI подскажет короткий B2B-ответ через Claude/Алексей daemon"
          >
            {aiLoading ? '🤖 думаю...' : '🤖 AI подсказка'}
          </button>
        </div>

        {aiSuggestion && (
          <div className="mb-2 px-2 py-1.5 bg-purple-50 border border-purple-200 rounded text-[11px] text-purple-900 italic">
            💡 {aiSuggestion}
          </div>
        )}

        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={`Ответить через ${targetMeta.label}...`}
          className="w-full px-3 py-2 border border-gray-200 rounded text-[13px] resize-none focus:outline-none focus:border-blue-500"
          rows={3}
          disabled={sending}
        />

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={send}
            disabled={sending || !reply.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Отправляю...' : `Отправить через ${targetMeta.icon} ${targetMeta.label}`}
          </button>
          {sendResult && (
            <span
              className={`text-[11px] ${sendResult.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}
            >
              {sendResult}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

export default OmnichannelInbox

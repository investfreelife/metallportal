'use client'

import { RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConversationCard } from './InboxApp'
import { CHANNEL_META } from './InboxApp'

interface ThreadMessage {
  id: string
  channel: string
  direction: 'inbound' | 'outbound'
  sender_name: string | null
  sender_address: string | null
  subject: string | null
  body: string
  is_internal: boolean
  attachments: any[]
  created_at: string
  source_table: string
  source_id: string
}

interface Template {
  id: number
  name: string
  category: string | null
  channel: string | null
  body: string
  shortcut: string | null
}

interface Props {
  conversation: ConversationCard
  composerRef: RefObject<HTMLTextAreaElement | null>
  onSent: () => void
}

function timeFmt(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function renderTemplate(body: string, contact: { name: string | null; first_name: string }) {
  return body
    .replace(/\{contact\.first_name\}/g, contact.first_name)
    .replace(/\{contact\.name\}/g, contact.name || 'клиент')
    .replace(/\{contact\.first_name\}/gi, contact.first_name)
}

export function ThreadView({ conversation, composerRef, onSent }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [targetChannel, setTargetChannel] = useState<string>(conversation.channel)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [scheduleSend, setScheduleSend] = useState<string>('now') // 'now' / 'morning' / 'custom'
  const [isInternalNote, setIsInternalNote] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const contactFirstName = (conversation.contact_name || 'клиент').split(' ')[0]

  // Load thread on conversation change
  useEffect(() => {
    setLoading(true)
    setError(null)
    setReply('')
    setSendResult(null)
    setTargetChannel(conversation.channel)
    setIsInternalNote(false)

    fetch(`/api/inbox/conversations/${encodeURIComponent(conversation.id)}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages || [])
      })
      .catch((e) => setError(e?.message ?? 'load failed'))
      .finally(() => setLoading(false))
  }, [conversation.id])

  // Load templates once
  useEffect(() => {
    fetch('/api/inbox/templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {})
  }, [])

  // Auto-scroll to bottom on messages load
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100)
  }, [messages])

  // Realtime subscription for new messages в этой conversation
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`thread_${conversation.id}`)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'activities' }, () => {
        // Reload thread after small delay (allows multi-message inserts)
        setTimeout(() => {
          fetch(`/api/inbox/conversations/${encodeURIComponent(conversation.id)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => setMessages(d.messages || []))
            .catch(() => {})
        }, 300)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id])

  const targetMeta = CHANNEL_META[targetChannel] || CHANNEL_META.email

  async function send(asScheduled = false) {
    if (!reply.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      if (asScheduled) {
        // Phase 1: just simulate с alert — real scheduled send Phase 2 (cron job)
        setSendResult('⏰ Запланировано на завтра 9:00 (Phase 2 cron)')
        setSending(false)
        return
      }
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: isInternalNote ? 'note' : targetChannel,
          contact_id: conversation.contact_id,
          contact_phone: conversation.contact_phone,
          contact_email: conversation.contact_email,
          subject: conversation.subject ? `Re: ${conversation.subject}` : undefined,
          body: reply,
          in_reply_to_id: messages[messages.length - 1]?.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSendResult(`✓ ${data.evidence || 'отправлено'}`)
        setReply('')
        onSent()
      } else {
        setSendResult(`✗ ${data.error || `HTTP ${res.status}`}`)
      }
    } catch (e: any) {
      setSendResult(`✗ ${e?.message || 'network error'}`)
    } finally {
      setSending(false)
    }
  }

  async function aiDraft() {
    setAiLoading(true)
    try {
      const lastInbound = messages.filter((m) => m.direction === 'inbound').slice(-1)[0] || messages[messages.length - 1]
      const res = await fetch('/api/inbox/ai-suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: targetChannel,
          contact_name: conversation.contact_name,
          subject: conversation.subject,
          body: lastInbound?.body || conversation.last_message_preview,
        }),
      })
      const data = await res.json()
      if (res.ok && data.suggestion) {
        setReply(data.suggestion)
      }
    } catch {} finally {
      setAiLoading(false)
    }
  }

  function applyTemplate(t: Template) {
    const text = renderTemplate(t.body, { name: conversation.contact_name, first_name: contactFirstName })
    setReply(text)
    setShowTemplates(false)
  }

  function handleComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter → send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send(false)
    }
    // Slash shortcut (start of textarea) → templates
    if (e.key === '/' && reply === '') {
      setShowTemplates(true)
    }
  }

  const channelMeta = CHANNEL_META[conversation.channel] || CHANNEL_META.form

  return (
    <div className="flex h-full min-w-0">
      {/* Center: Thread + Composer */}
      <div className="flex-1 min-w-0 flex flex-col bg-white">
        {/* Thread header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-baseline gap-3 flex-wrap">
          <span className={`text-[11px] px-2 py-0.5 rounded ${channelMeta.color} font-medium`}>
            {channelMeta.icon} {channelMeta.label}
          </span>
          <h2 className="text-[14px] font-semibold text-gray-900 truncate">
            {conversation.contact_name}
          </h2>
          {conversation.contact_phone && (
            <a href={`tel:${conversation.contact_phone}`} className="text-[12px] text-blue-600 hover:underline">
              {conversation.contact_phone}
            </a>
          )}
          {conversation.contact_email && (
            <a href={`mailto:${conversation.contact_email}`} className="text-[12px] text-blue-600 hover:underline">
              {conversation.contact_email}
            </a>
          )}
          <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
            <button title="Архивировать (Phase 2)" className="hover:text-gray-700 disabled:opacity-50" disabled>
              📦 Архив
            </button>
            <span className="text-gray-300">·</span>
            <button title="Snooze (Phase 2)" className="hover:text-gray-700 disabled:opacity-50" disabled>
              ⏰ Отложить
            </button>
            <span className="text-gray-300">·</span>
            <button title="Назначить" className="hover:text-gray-700 disabled:opacity-50" disabled>
              👤 Назначить
            </button>
          </div>
        </div>

        {conversation.subject && (
          <div className="px-5 py-2 border-b border-gray-100 bg-gray-50 text-[12px] font-medium text-gray-700 truncate">
            {conversation.subject}
          </div>
        )}

        {/* Message bubbles */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
          {loading && <div className="text-[12px] text-gray-400">Загружаю сообщения...</div>}
          {error && <div className="text-[12px] text-red-600 bg-red-50 p-2 rounded">Ошибка: {error}</div>}
          {!loading && messages.length === 0 && (
            <div className="text-[12px] text-gray-400 italic">Нет сообщений в этой беседе</div>
          )}
          {messages.map((m) => {
            const isInbound = m.direction === 'inbound'
            const mChannelMeta = CHANNEL_META[m.channel] || channelMeta
            return (
              <div
                key={m.id}
                className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    m.is_internal
                      ? 'bg-amber-50 border border-amber-200'
                      : isInbound
                      ? 'bg-white border border-gray-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="flex items-baseline gap-2 mb-1 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${mChannelMeta.color} font-medium`}>
                      {mChannelMeta.icon} {mChannelMeta.label}
                    </span>
                    <span className="font-medium text-gray-700">{m.sender_name || (isInbound ? 'Клиент' : 'Менеджер')}</span>
                    {m.is_internal && (
                      <span className="text-amber-700 font-bold">🔒 внутренняя заметка</span>
                    )}
                    <span className="text-gray-400 ml-auto">{timeFmt(m.created_at)}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-[13px] text-gray-800 leading-relaxed">
                    {m.body || <span className="italic text-gray-400">(пусто)</span>}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0 relative">
          {/* Templates dropdown */}
          {showTemplates && (
            <div className="absolute left-4 right-4 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto z-10">
              <div className="px-3 py-2 border-b border-gray-100 text-[11px] font-semibold text-gray-700 flex items-baseline justify-between">
                <span>Шаблоны ответов · {templates.length}</span>
                <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              {templates.length === 0 ? (
                <div className="px-3 py-4 text-[11px] text-gray-400">Нет шаблонов</div>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-medium text-gray-900">{t.name}</span>
                      {t.category && <span className="text-[10px] text-gray-500">{t.category}</span>}
                      {t.shortcut && (
                        <kbd className="ml-auto text-[10px] px-1 bg-gray-100 border border-gray-200 rounded font-mono">
                          {t.shortcut}
                        </kbd>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                      {t.body.split('\n')[0].slice(0, 80)}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Composer toolbar */}
          <div className="flex items-center gap-2 mb-2 text-[11px] flex-wrap">
            <label className="text-gray-500">Ответить через:</label>
            <select
              value={targetChannel}
              onChange={(e) => setTargetChannel(e.target.value)}
              disabled={isInternalNote}
              className="border border-gray-200 rounded px-2 py-1 text-[12px] bg-white disabled:opacity-50"
            >
              {Object.entries(CHANNEL_META).filter(([k]) => k !== 'note').map(([k, m]) => (
                <option key={k} value={k}>{m.icon} {m.label}</option>
              ))}
            </select>

            <label className="ml-2 inline-flex items-center gap-1 text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                className="w-3 h-3"
              />
              🔒 Внутренняя заметка
            </label>

            <button
              onClick={() => setShowTemplates((s) => !s)}
              className="text-blue-600 hover:text-blue-800"
              title="Шаблоны (или / в пустом поле)"
            >
              📋 Шаблоны
            </button>
            <button
              onClick={aiDraft}
              disabled={aiLoading}
              className="text-purple-600 hover:text-purple-800 disabled:opacity-50"
              title="AI-черновик ответа"
            >
              {aiLoading ? '🤖 думаю...' : '🤖 AI черновик'}
            </button>
            <span className="ml-auto text-[10px] text-gray-400">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded border text-[9px] font-mono">⌘+↵</kbd> отправить
            </span>
          </div>

          {/* Textarea */}
          <textarea
            ref={composerRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleComposerKey}
            placeholder={
              isInternalNote
                ? 'Внутренняя заметка (видна только команде)...'
                : `Ответить через ${targetMeta.label}... (нажми / для шаблонов)`
            }
            className={`w-full px-3 py-2 border border-gray-200 rounded text-[13px] resize-none focus:outline-none focus:border-blue-500 ${
              isInternalNote ? 'bg-amber-50' : ''
            }`}
            rows={4}
            disabled={sending}
          />

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              onClick={() => send(false)}
              disabled={sending || !reply.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {sending
                ? 'Отправляю...'
                : isInternalNote
                ? '🔒 Сохранить заметку'
                : `Отправить через ${targetMeta.icon} ${targetMeta.label}`}
            </button>

            <select
              value={scheduleSend}
              onChange={(e) => setScheduleSend(e.target.value)}
              className="text-[11px] border border-gray-200 rounded px-2 py-1 bg-white"
              title="Запланировать отправку"
              disabled={isInternalNote}
            >
              <option value="now">✉ Сейчас</option>
              <option value="morning">⏰ Завтра 9:00</option>
            </select>
            {scheduleSend !== 'now' && (
              <button
                onClick={() => send(true)}
                disabled={!reply.trim()}
                className="text-[11px] text-purple-600 hover:text-purple-800 disabled:opacity-50"
              >
                Запланировать
              </button>
            )}

            <button
              disabled
              className="ml-auto text-[11px] text-gray-400 cursor-not-allowed"
              title="Drag-n-drop attachments — Phase 2"
            >
              📎 Прикрепить
            </button>

            {sendResult && (
              <div className={`w-full text-[11px] mt-1 ${sendResult.startsWith('✓') ? 'text-green-700' : sendResult.startsWith('⏰') ? 'text-purple-700' : 'text-red-600'}`}>
                {sendResult}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Contact panel */}
      <ContactPanel conversation={conversation} messages={messages} />
    </div>
  )
}

function ContactPanel({ conversation, messages }: { conversation: ConversationCard; messages: ThreadMessage[] }) {
  const inbound = messages.filter((m) => m.direction === 'inbound').length
  const outbound = messages.filter((m) => m.direction === 'outbound').length
  const firstMessage = messages[0]
  const lastInbound = messages.filter((m) => m.direction === 'inbound').slice(-1)[0]
  const responseTimeMs = lastInbound && messages.find((m) => m.direction === 'outbound' && m.created_at > lastInbound.created_at)
    ? new Date(messages.find((m) => m.direction === 'outbound' && m.created_at > lastInbound.created_at)!.created_at).getTime() - new Date(lastInbound.created_at).getTime()
    : null

  return (
    <aside className="flex-shrink-0 w-72 bg-gray-50 border-l border-gray-200 overflow-y-auto hidden lg:block">
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <h3 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wider">Контакт</h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-sm">
            {(conversation.contact_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-gray-900 truncate">
              {conversation.contact_name}
            </div>
            {conversation.contact_company && (
              <div className="text-[11px] text-gray-500 truncate">{conversation.contact_company}</div>
            )}
          </div>
        </div>

        {/* AI score */}
        {conversation.ai_score !== null && (
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">AI Score</div>
            <div className="flex items-center gap-2">
              <div className={`text-[20px] font-bold ${conversation.ai_score >= 70 ? 'text-red-600' : conversation.ai_score >= 40 ? 'text-orange-600' : 'text-gray-600'}`}>
                {conversation.ai_score}
              </div>
              <div className="text-[11px] text-gray-500">
                {conversation.ai_segment === 'hot' ? '🔥 hot lead'
                  : conversation.ai_segment === 'warm' ? '🌡 warm'
                  : conversation.ai_segment === 'cold' ? '❄ cold'
                  : '— нет сегмента'}
              </div>
            </div>
          </div>
        )}

        {/* Contacts info */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 text-[11px]">
          {conversation.contact_phone && (
            <div className="flex items-baseline gap-2">
              <span className="text-gray-500 w-12 flex-shrink-0">Тел:</span>
              <a href={`tel:${conversation.contact_phone}`} className="text-blue-600 hover:underline truncate">
                {conversation.contact_phone}
              </a>
            </div>
          )}
          {conversation.contact_email && (
            <div className="flex items-baseline gap-2">
              <span className="text-gray-500 w-12 flex-shrink-0">Email:</span>
              <a href={`mailto:${conversation.contact_email}`} className="text-blue-600 hover:underline truncate">
                {conversation.contact_email}
              </a>
            </div>
          )}
        </div>

        {/* Conversation stats */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5 text-[11px]">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Беседа</div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-600">Канал:</span>
            <span className="font-medium text-gray-900">
              {CHANNEL_META[conversation.channel]?.icon} {CHANNEL_META[conversation.channel]?.label}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-600">Приоритет:</span>
            <span className="font-medium text-gray-900 capitalize">{conversation.priority}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-600">Входящих:</span>
            <span className="font-medium text-gray-900">{inbound}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-600">Исходящих:</span>
            <span className="font-medium text-gray-900">{outbound}</span>
          </div>
          {firstMessage && (
            <div className="flex items-baseline justify-between">
              <span className="text-gray-600">Первое:</span>
              <span className="text-gray-700 text-[10px]">{timeFmt(firstMessage.created_at)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {conversation.tags.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Тэги</div>
            <div className="flex flex-wrap gap-1">
              {conversation.tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        {conversation.contact_id && (
          <a
            href={`/contacts/${conversation.contact_id}`}
            className="block w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-center text-[12px] text-blue-600 hover:bg-blue-50 hover:border-blue-200"
          >
            📇 Карточка контакта →
          </a>
        )}

        {/* Phase 2 placeholders */}
        <div className="text-[10px] text-gray-400 italic px-1 leading-relaxed">
          Phase 2 backlog: история сделок · last order · SLA timer · auto-tag · @mentions · merge conversations.
        </div>
      </div>
    </aside>
  )
}

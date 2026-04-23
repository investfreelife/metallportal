'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Send, Sparkles, RefreshCw, ArrowLeft, Mail,
  MessageCircle, Phone, Pencil, Bot, ChevronDown,
} from 'lucide-react'

type Channel = 'telegram' | 'email' | 'note'

interface ChatMsg {
  id: string
  source: 'activity' | 'email'
  channel: string
  type: string
  direction: 'in' | 'out'
  subject?: string | null
  body: string
  created_at: string
  is_ai?: boolean
  author?: string | null
  deal_id?: string | null
}

interface ContactInfo {
  id: string
  full_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  telegram: string | null
  telegram_chat_id: string | null
}

const CH: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  telegram: { icon: '✈️', label: 'Telegram', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  email:    { icon: '✉️', label: 'Email',    color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  call:     { icon: '📞', label: 'Звонок',  color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  note:     { icon: '📝', label: 'Заметка', color: 'text-gray-400',  bg: 'bg-gray-800 border-gray-700' },
  message:  { icon: '💬', label: 'Сообщение', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  whatsapp: { icon: '🟢', label: 'WhatsApp', color: 'text-green-300', bg: 'bg-green-500/10 border-green-500/20' },
}

function fmt(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const isYear = d.getFullYear() === today.getFullYear()
  if (isToday) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  if (isYear) return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MsgBubble({ msg }: { msg: ChatMsg }) {
  const ch = CH[msg.channel] ?? CH.note
  const isOut = msg.direction === 'out'
  return (
    <div className={`flex gap-3 ${isOut ? 'flex-row-reverse' : ''} group`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1 ${ch.bg} border`}>
        {ch.icon}
      </div>
      <div className={`max-w-[72%] space-y-1 ${isOut ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-2 text-xs ${isOut ? 'flex-row-reverse' : ''}`}>
          <span className={ch.color}>{ch.label}</span>
          {msg.author && <span className="text-gray-500">{msg.author}</span>}
          {msg.is_ai && <span className="text-purple-400 bg-purple-500/10 px-1 rounded">ИИ</span>}
          <span className="text-gray-600">{fmt(msg.created_at)}</span>
        </div>
        <div className={`rounded-xl px-3.5 py-2.5 text-sm border ${ch.bg} ${isOut ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
          {msg.subject && (
            <p className="text-xs font-semibold text-gray-300 mb-1 border-b border-white/10 pb-1">{msg.subject}</p>
          )}
          <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{msg.body || '—'}</p>
        </div>
      </div>
    </div>
  )
}

export default function ChatClient({ contact }: { contact: ContactInfo }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<Channel>('telegram')
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiChannel, setAiChannel] = useState<Channel | null>(null)
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const hasTelegram = Boolean(contact.telegram_chat_id)
  const hasEmail = Boolean(contact.email)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/contacts/${contact.id}/messages`)
    const d = await res.json()
    setMessages(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [contact.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Set default channel based on contact info
  useEffect(() => {
    if (hasTelegram) setChannel('telegram')
    else if (hasEmail) setChannel('email')
    else setChannel('note')
  }, [hasTelegram, hasEmail])

  const lastInbound = messages.filter(m => m.direction === 'in').at(-1)

  const suggestReply = async () => {
    setAiLoading(true)
    const res = await fetch(`/api/contacts/${contact.id}/suggest-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_message: lastInbound?.body, channel_hint: channel }),
    })
    const d = await res.json()
    if (d.text) {
      setText(d.text)
      if (d.channel && d.channel !== channel) {
        setAiChannel(d.channel)
      }
    }
    setAiLoading(false)
    textRef.current?.focus()
  }

  const send = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    setSendStatus(null)

    let endpoint = ''
    let body: Record<string, unknown> = {}

    if (channel === 'telegram') {
      endpoint = `/api/contacts/${contact.id}/send-telegram`
      body = { message: trimmed }
    } else if (channel === 'email') {
      endpoint = `/api/contacts/${contact.id}/send-email`
      body = { subject: subject.trim() || `Сообщение от менеджера`, body: trimmed }
    } else {
      // Log as note activity
      endpoint = `/api/activities`
      body = {
        contact_id: contact.id,
        type: 'note',
        direction: 'outbound',
        subject: 'Заметка менеджера',
        body: trimmed,
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setSending(false)

    if (d.ok || d.id || res.ok) {
      setSendStatus({ ok: true, msg: channel === 'telegram' ? 'Отправлено в Telegram' : channel === 'email' ? 'Письмо отправлено' : 'Заметка сохранена' })
      setText('')
      setSubject('')
      setAiChannel(null)
      setTimeout(() => setSendStatus(null), 3000)
      load()
    } else {
      setSendStatus({ ok: false, msg: d.error ?? 'Ошибка отправки' })
    }
  }

  const displayName = contact.full_name || contact.company_name || 'Контакт'

  const channels: { id: Channel; icon: string; label: string; disabled?: boolean; hint?: string }[] = [
    { id: 'telegram', icon: '✈️', label: 'Telegram', disabled: !hasTelegram, hint: !hasTelegram ? 'Нет chat_id' : undefined },
    { id: 'email',    icon: '✉️', label: 'Email',    disabled: !hasEmail,    hint: !hasEmail ? 'Нет email' : undefined },
    { id: 'note',     icon: '📝', label: 'Заметка'  },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <Link href={`/contacts/${contact.id}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate">{displayName}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone}</span>}
            {contact.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>}
            {contact.telegram && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{contact.telegram}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact.telegram && (
            <a href={`https://t.me/${contact.telegram.replace('@', '')}`} target="_blank"
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded-lg border border-blue-500/20 transition-colors">
              Открыть t.me
            </a>
          )}
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-300 transition-colors" title="Обновить">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Загрузка истории...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-600 text-center">
            <MessageCircle className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Нет истории общения</p>
            <p className="text-xs mt-1 text-gray-700">Напишите первое сообщение ниже</p>
          </div>
        ) : (
          <>
            {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900 p-4 space-y-3">
        {/* Channel selector */}
        <div className="flex items-center gap-2">
          {channels.map(ch => (
            <button key={ch.id} onClick={() => !ch.disabled && setChannel(ch.id)}
              title={ch.hint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                channel === ch.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : ch.disabled
                    ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}>
              <span>{ch.icon}</span>
              <span>{ch.label}</span>
              {ch.hint && <span className="text-xs opacity-60">({ch.hint})</span>}
            </button>
          ))}

          {/* AI channel recommendation */}
          {aiChannel && aiChannel !== channel && (
            <button onClick={() => { setChannel(aiChannel); setAiChannel(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors ml-auto">
              <Sparkles className="w-3.5 h-3.5" />
              ИИ рекомендует {CH[aiChannel]?.label} <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Email subject */}
        {channel === 'email' && (
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Тема письма..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
        )}

        {/* Message input */}
        <div className="flex gap-2">
          <textarea ref={textRef}
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
            placeholder={
              channel === 'telegram' ? 'Сообщение в Telegram... (Ctrl+Enter для отправки)' :
              channel === 'email' ? 'Текст письма...' : 'Заметка о клиенте...'
            }
            rows={3}
            className="flex-1 px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={suggestReply} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 text-purple-400 text-sm rounded-lg transition-colors disabled:opacity-50">
            {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiLoading ? 'Генерирую...' : 'Предложить ответ ИИ'}
          </button>

          {sendStatus && (
            <span className={`text-xs px-3 py-2 rounded-lg border ${
              sendStatus.ok ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {sendStatus.msg}
            </span>
          )}

          <div className="flex-1" />

          <button onClick={send} disabled={sending || !text.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {channel === 'telegram' ? 'Telegram' : channel === 'email' ? 'Отправить' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

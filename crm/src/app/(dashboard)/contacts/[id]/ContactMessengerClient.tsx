'use client'

import { useState } from 'react'
import { Send, MessageCircle, Mail, Edit2, Check, X, Phone } from 'lucide-react'

interface Props {
  contactId: string
  initialEmail?: string
  initialPhone?: string
  initialTelegram?: string       // @username
  initialTelegramChatId?: string // числовой chat_id для бота
}

export default function ContactMessengerClient({
  contactId,
  initialEmail,
  initialPhone,
  initialTelegram,
  initialTelegramChatId,
}: Props) {
  const [tab, setTab] = useState<'telegram' | 'email'>('telegram')
  const [tgMsg, setTgMsg] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Edit mode for contact fields
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({
    email: initialEmail ?? '',
    phone: initialPhone ?? '',
    telegram: initialTelegram ?? '',
    telegram_chat_id: initialTelegramChatId ?? '',
  })
  const [saving, setSaving] = useState(false)

  const saveFields = async () => {
    setSaving(true)
    await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    setSaving(false)
    setEditing(false)
  }

  const sendTelegram = async () => {
    if (!tgMsg.trim()) return
    setSending(true); setResult(null)
    const res = await fetch(`/api/contacts/${contactId}/send-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: tgMsg }),
    })
    const d = await res.json()
    setResult({ ok: d.ok, msg: d.message ?? (d.error || 'Ошибка') })
    if (d.ok) setTgMsg('')
    setSending(false)
  }

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSending(true); setResult(null)
    const res = await fetch(`/api/contacts/${contactId}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: emailSubject, body: emailBody }),
    })
    const d = await res.json()
    setResult({ ok: d.ok, msg: d.message ?? (d.error || 'Ошибка') })
    if (d.ok) { setEmailSubject(''); setEmailBody('') }
    setSending(false)
  }

  const hasTg = !!(fields.telegram_chat_id || fields.telegram)
  const hasEmail = !!fields.email

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header — контактные данные + edit */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Контактные данные</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors">
              <Edit2 className="w-3 h-3" /> Изменить
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveFields} disabled={saving}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                <Check className="w-3 h-3" /> {saving ? 'Сохраняю...' : 'Сохранить'}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'phone', label: 'Телефон', placeholder: '+7 999 123-45-67' },
              { key: 'email', label: 'Email', placeholder: 'client@example.com' },
              { key: 'telegram', label: 'Telegram username', placeholder: '@username' },
              { key: 'telegram_chat_id', label: 'Telegram chat_id (для бота)', placeholder: '123456789' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-gray-500 text-xs mb-1 block">{label}</label>
                <input
                  value={fields[key as keyof typeof fields]}
                  onChange={e => setFields(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {fields.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <a href={`tel:${fields.phone}`} className="text-gray-300 text-sm hover:text-white">{fields.phone}</a>
              </div>
            )}
            {fields.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <a href={`mailto:${fields.email}`} className="text-gray-300 text-sm hover:text-blue-400">{fields.email}</a>
              </div>
            )}
            {fields.telegram && (
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <a href={`https://t.me/${fields.telegram.replace('@', '')}`} target="_blank" rel="noreferrer"
                  className="text-gray-300 text-sm hover:text-blue-400">{fields.telegram}</a>
                {fields.telegram_chat_id && (
                  <span className="text-gray-600 text-xs">· chat_id: {fields.telegram_chat_id}</span>
                )}
              </div>
            )}
            {!fields.phone && !fields.email && !fields.telegram && (
              <p className="text-gray-600 text-sm">Нет контактных данных</p>
            )}
          </div>
        )}
      </div>

      {/* Tabs: Telegram / Email */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setTab('telegram')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
            ${tab === 'telegram' ? 'text-blue-400 border-b-2 border-blue-400 -mb-px bg-blue-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
          <MessageCircle className="w-3.5 h-3.5" /> Telegram
          {!hasTg && <span className="text-gray-600 text-xs">(не настроен)</span>}
        </button>
        <button
          onClick={() => setTab('email')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
            ${tab === 'email' ? 'text-amber-400 border-b-2 border-amber-400 -mb-px bg-amber-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
          <Mail className="w-3.5 h-3.5" /> Email
          {!hasEmail && <span className="text-gray-600 text-xs">(не указан)</span>}
        </button>
      </div>

      {/* Telegram panel */}
      {tab === 'telegram' && (
        <div className="px-5 py-4 space-y-3">
          {!hasTg ? (
            <p className="text-gray-500 text-sm text-center py-4">
              Укажите <span className="text-amber-400">@username</span> или <span className="text-amber-400">chat_id</span> клиента выше, чтобы отправить сообщение через бота
            </p>
          ) : (
            <>
              <textarea
                value={tgMsg}
                onChange={e => setTgMsg(e.target.value)}
                placeholder={`Сообщение клиенту ${fields.telegram || ''}...`}
                rows={3}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              />
              <button onClick={sendTelegram} disabled={sending || !tgMsg.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Отправляю...' : 'Отправить в Telegram'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Email panel */}
      {tab === 'email' && (
        <div className="px-5 py-4 space-y-3">
          {!hasEmail ? (
            <p className="text-gray-500 text-sm text-center py-4">
              Укажите <span className="text-amber-400">email</span> клиента выше, чтобы отправить письмо
            </p>
          ) : (
            <>
              <input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Тема письма..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                placeholder={`Текст письма для ${fields.email}...`}
                rows={4}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              />
              <button onClick={sendEmail} disabled={sending || !emailSubject.trim() || !emailBody.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Отправляю...' : `Отправить на ${fields.email}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Result message */}
      {result && (
        <div className={`mx-5 mb-4 px-3 py-2 rounded-lg text-xs ${result.ok ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {result.msg}
        </div>
      )}
    </div>
  )
}

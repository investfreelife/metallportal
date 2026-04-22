'use client'

import { useState, useEffect } from 'react'
import { X, Send, ChevronDown } from 'lucide-react'

interface EmailAccount { id: string; email: string; display_name: string; provider: string; is_default?: boolean }
interface Props {
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  dealId?: string
  contactId?: string
  inReplyTo?: string
  threadId?: string
  onSent?: (emailId: string) => void
}

export default function ComposeModal({ onClose, defaultTo = '', defaultSubject = '', defaultBody = '', dealId, contactId, inReplyTo, threadId, onSent }: Props) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [to, setTo] = useState(defaultTo)
  const [cc, setCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/emails/accounts').then(r => r.json()).then((data: EmailAccount[]) => {
      if (Array.isArray(data)) {
        setAccounts(data)
        if (data.length > 0) setAccountId(data.find(a => a.is_default)?.id ?? data[0].id)
      }
    })
  }, [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId) { setError('Выберите почтовый ящик'); return }
    if (!to.trim()) { setError('Укажите получателя'); return }
    if (!subject.trim()) { setError('Укажите тему письма'); return }
    setSending(true); setError('')

    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        subject,
        body_html: body.replace(/\n/g, '<br>'),
        body_text: body,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
        in_reply_to: inReplyTo ?? null,
        thread_id: threadId ?? null,
      }),
    })
    const d = await res.json()
    setSending(false)
    if (!res.ok) { setError(d.error ?? 'Ошибка отправки'); return }
    onSent?.(d.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">{inReplyTo ? 'Ответить' : 'Новое письмо'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={send} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-3 space-y-2 border-b border-gray-800">
            {/* From */}
            {accounts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs w-12 text-right">От:</span>
                <select value={accountId} onChange={e => setAccountId(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-blue-500 py-1">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.display_name || a.email} &lt;{a.email}&gt;</option>)}
                </select>
              </div>
            )}
            {accounts.length === 0 && (
              <p className="text-amber-400 text-xs">Почтовые ящики не подключены. <a href="/settings/email" className="underline">Настроить</a></p>
            )}

            {/* To */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs w-12 text-right">Кому:</span>
              <input value={to} onChange={e => setTo(e.target.value)} type="text"
                placeholder="email@example.com, ..."
                className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-blue-500 py-1 placeholder-gray-600" />
              <button type="button" onClick={() => setShowCc(v => !v)}
                className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-0.5">
                Копия <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* CC */}
            {showCc && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs w-12 text-right">Копия:</span>
                <input value={cc} onChange={e => setCc(e.target.value)} type="text"
                  placeholder="cc@example.com"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-blue-500 py-1 placeholder-gray-600" />
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs w-12 text-right">Тема:</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} type="text"
                placeholder="Тема письма"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-blue-500 py-1 placeholder-gray-600 font-medium" />
            </div>

            {/* Deal link badge */}
            {dealId && <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">📎 Привязано к сделке</span>}
          </div>

          {/* Body */}
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Текст письма..."
            className="flex-1 bg-transparent text-gray-200 text-sm focus:outline-none resize-none px-5 py-4 min-h-40 placeholder-gray-600"
          />

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between gap-3">
            {error ? <p className="text-red-400 text-xs">{error}</p> : <span />}
            <button type="submit" disabled={sending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              <Send className="w-4 h-4" />
              {sending ? 'Отправляю...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

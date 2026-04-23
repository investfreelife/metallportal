'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, RefreshCw, Pen, Star, StarOff, Check, ArrowLeft, Reply, Link2, Inbox, Sparkles } from 'lucide-react'
import ComposeModal from '@/components/emails/ComposeModal'

interface Email {
  id: string
  direction: string
  from_email: string
  from_name: string
  to_emails: { email: string; name?: string }[]
  subject: string
  body_text: string | null
  body_html: string | null
  is_read: boolean
  is_starred: boolean
  received_at: string | null
  sent_at: string | null
  deal_id: string | null
  contact_id: string | null
  account_id: string
  thread_id: string | null
}

interface Deal { id: string; title: string }

function formatDate(d: string | null) {
  if (!d) return ''
  const date = new Date(d)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function EmailRow({ email, selected, onClick }: { email: Email; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-800/60 transition-colors ${
        selected ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/40'
      }`}>
      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-sm font-medium text-gray-300">
        {(email.from_name || email.from_email)[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate flex-1 ${!email.is_read ? 'font-semibold text-white' : 'text-gray-300'}`}>
            {email.direction === 'outbound' ? `→ ${email.to_emails?.[0]?.email}` : (email.from_name || email.from_email)}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(email.received_at ?? email.sent_at)}</span>
        </div>
        <p className={`text-sm truncate ${!email.is_read ? 'text-gray-200' : 'text-gray-500'}`}>{email.subject}</p>
        <p className="text-xs text-gray-600 truncate">{email.body_text?.slice(0, 80)}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {!email.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />}
          {email.deal_id && <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 rounded">📎 Сделка</span>}
          {email.direction === 'outbound' && <span className="text-xs text-green-500 bg-green-500/10 px-1.5 rounded">→ Исходящее</span>}
        </div>
      </div>
    </button>
  )
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [selected, setSelected] = useState<Email | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [compose, setCompose] = useState(false)
  const [reply, setReply] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [linkingDeal, setLinkingDeal] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<{ intent: string; reasoning: string; suggested_reply: string; action_type: string; priority: string; queue_id?: string } | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/emails')
      const data = await res.json()
      if (Array.isArray(data)) {
        setEmails(data)
      } else {
        setEmails([])
        if (data?.error) setLoadError(data.error)
      }
    } catch (e) { setEmails([]); setLoadError(String(e)) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    // Background auto-sync on open (non-blocking)
    setSyncing(true)
    fetch('/api/emails/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(() => load())
      .catch(() => {})
      .finally(() => setSyncing(false))
  }, [load])

  useEffect(() => {
    fetch('/api/deals').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setDeals(d.map((x: { id: string; title: string }) => ({ id: x.id, title: x.title })))
    }).catch(() => {})
  }, [])

  const [syncResult, setSyncResult] = useState<string | null>(null)

  const syncAll = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await fetch('/api/emails/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const d = await r.json()
      if (d.ok) {
        if (d.synced > 0) setSyncResult(`+${d.synced} новых`)
        else setSyncResult('Новых нет')
      } else setSyncResult('Ошибка: ' + (d.error ?? JSON.stringify(d)))
    } catch {
      setSyncResult('Нет ответа')
    } finally {
      setSyncing(false)
    }
    load()
  }

  const markRead = async (id: string) => {
    await fetch('/api/emails', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_read: true }) })
    setEmails(prev => prev.map(e => e.id === id ? { ...e, is_read: true } : e))
  }

  const toggleStar = async (email: Email) => {
    await fetch('/api/emails', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: email.id, is_starred: !email.is_starred }) })
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_starred: !e.is_starred } : e))
    if (selected?.id === email.id) setSelected(prev => prev ? { ...prev, is_starred: !prev.is_starred } : prev)
  }

  const linkToDeal = async (emailId: string, dealId: string) => {
    await fetch('/api/emails', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: emailId, deal_id: dealId }) })
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, deal_id: dealId } : e))
    if (selected?.id === emailId) setSelected(prev => prev ? { ...prev, deal_id: dealId } : prev)
    setLinkingDeal(false)
  }

  const openEmail = (email: Email) => {
    setSelected(email)
    setAiResult(null)
    setAiError(null)
    if (!email.is_read) markRead(email.id)
  }

  const runAI = async (emailId: string) => {
    setAiAnalyzing(true)
    setAiResult(null)
    setAiError(null)
    try {
      const r = await fetch(`/api/emails/${emailId}/analyze`, { method: 'POST' })
      const d = await r.json()
      if (d.ok && d.ai) setAiResult({ ...d.ai, queue_id: d.queue_id })
      else if (d.ok && d.already) setAiResult({ intent: 'Уже анализировано', reasoning: 'Задача уже есть в Очереди ИИ', suggested_reply: '', action_type: '', priority: '', queue_id: d.queue_id })
      else setAiError(d.error ?? 'Неизвестная ошибка')
    } catch { setAiError('Нет ответа от сервера') }
    finally { setAiAnalyzing(false) }
  }

  const unread = emails.filter(e => !e.is_read && e.direction === 'inbound').length

  return (
    <div className="flex h-full">
      {/* Sidebar — email list */}
      <div className={`flex flex-col border-r border-gray-800 ${selected ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 flex-shrink-0`}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 flex-1">
            <Inbox className="w-4 h-4 text-gray-400" />
            <h1 className="text-white font-semibold text-sm">Входящие</h1>
            {unread > 0 && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{unread}</span>}
          </div>
          <button onClick={syncAll} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Скачиваю...' : 'Скачать почту'}
          </button>
          {syncResult && (
            <span className={`text-xs px-2 py-1 rounded ${syncResult.startsWith('Ошибка') || syncResult === 'Нет ответа' ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>
              {syncResult}
            </span>
          )}
          <button onClick={() => setCompose(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
            <Pen className="w-3.5 h-3.5" /> Написать
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Загрузка...</div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600 px-4 text-center">
              <Mail className="w-8 h-8 mb-2" />
              {loadError ? (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">Ошибка загрузки: {loadError}</p>
              ) : syncing ? (
                <p className="text-sm">Скачиваю почту...</p>
              ) : (
                <>
                  <p className="text-sm">Нет писем</p>
                  <a href="/settings" className="text-xs text-blue-400 hover:text-blue-300 mt-1.5 underline">Подключить ящик в Настройках → Почта</a>
                </>
              )}
            </div>
          ) : (
            emails.map(email => (
              <EmailRow key={email.id} email={email} selected={selected?.id === email.id} onClick={() => openEmail(email)} />
            ))
          )}
        </div>
      </div>

      {/* Email detail */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail toolbar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 flex-shrink-0">
            <button onClick={() => setSelected(null)} className="lg:hidden p-1.5 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button onClick={() => toggleStar(selected)} className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors">
              {selected.is_starred ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : <StarOff className="w-4 h-4" />}
            </button>
            <button onClick={() => markRead(selected.id)} className="p-1.5 text-gray-400 hover:text-green-400 transition-colors" title="Пометить прочитанным">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setLinkingDeal(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
              <Link2 className="w-3.5 h-3.5" /> {selected.deal_id ? 'Сделка привязана' : 'Привязать к сделке'}
            </button>
            <button onClick={() => runAI(selected.id)} disabled={aiAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              <Sparkles className={`w-3.5 h-3.5 ${aiAnalyzing ? 'animate-spin' : ''}`} />
              {aiAnalyzing ? 'Анализ...' : 'Анализ ИИ'}
            </button>
            <button onClick={() => setReply(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
              <Reply className="w-3.5 h-3.5" /> Ответить
            </button>
          </div>

          {/* AI result panel */}
          {(aiResult || aiError) && (
            <div className="px-5 py-3 border-b border-gray-800 bg-purple-500/5">
              {aiError ? (
                <p className="text-xs text-red-400">⚠️ {aiError}</p>
              ) : aiResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-purple-300">{aiResult.intent}</span>
                    {aiResult.priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        aiResult.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                        aiResult.priority === 'medium' ? 'bg-orange-500/20 text-orange-300' :
                        'bg-gray-700 text-gray-400'}`}>{aiResult.priority}</span>
                    )}
                    {aiResult.queue_id && (
                      <a href="/queue" className="text-xs text-purple-400 hover:text-purple-300 ml-auto underline">→ Очередь ИИ</a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{aiResult.reasoning}</p>
                  {aiResult.suggested_reply && (
                    <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap border border-purple-500/20">{aiResult.suggested_reply}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Deal link dropdown */}
          {linkingDeal && (
            <div className="px-5 py-2 border-b border-gray-800 bg-gray-900/50">
              <p className="text-xs text-gray-400 mb-2">Привязать к сделке:</p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {deals.map(d => (
                  <button key={d.id} onClick={() => linkToDeal(selected.id, d.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      selected.deal_id === d.id ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>{d.title}</button>
                ))}
                {deals.length === 0 && <span className="text-gray-600 text-xs">Нет сделок</span>}
              </div>
            </div>
          )}

          {/* Email content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <h2 className="text-white text-lg font-semibold mb-3">{selected.subject}</h2>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300 flex-shrink-0">
                {(selected.from_name || selected.from_email)[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{selected.from_name || selected.from_email}</p>
                <p className="text-xs text-gray-500">{selected.from_email}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  → {selected.to_emails?.map(t => t.email).join(', ')} · {formatDate(selected.received_at ?? selected.sent_at)}
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-5">
              {selected.body_html ? (
                <div className="prose prose-invert prose-sm max-w-none text-gray-300"
                  dangerouslySetInnerHTML={{ __html: selected.body_html }} />
              ) : (
                <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">{selected.body_text ?? '(нет содержимого)'}</pre>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden lg:flex items-center justify-center text-gray-600">
          <div className="text-center">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Выберите письмо</p>
          </div>
        </div>
      )}

      {/* Compose */}
      {compose && (
        <ComposeModal onClose={() => setCompose(false)} onSent={() => load()} />
      )}

      {/* Reply */}
      {reply && selected && (
        <ComposeModal
          onClose={() => setReply(false)}
          onSent={() => { setReply(false); load() }}
          defaultTo={selected.from_email}
          defaultSubject={selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`}
          dealId={selected.deal_id ?? undefined}
          contactId={selected.contact_id ?? undefined}
          inReplyTo={selected.id}
          threadId={selected.thread_id ?? undefined}
        />
      )}
    </div>
  )
}

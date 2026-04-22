'use client'

import { useState, useEffect } from 'react'
import { Mail, Pen, Reply, ArrowRight } from 'lucide-react'
import ComposeModal from '@/components/emails/ComposeModal'
import Link from 'next/link'

interface Email {
  id: string
  direction: string
  from_email: string
  from_name: string
  subject: string
  body_text: string | null
  is_read: boolean
  received_at: string | null
  sent_at: string | null
}

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DealEmailsClient({ dealId, contactEmail }: { dealId: string; contactEmail?: string }) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [compose, setCompose] = useState(false)
  const [replyTo, setReplyTo] = useState<Email | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/emails?deal_id=${dealId}`)
    const data = await res.json()
    setEmails(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dealId])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" /> Переписка по сделке
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCompose(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
            <Pen className="w-3.5 h-3.5" /> Написать письмо
          </button>
          <Link href="/emails" className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors">
            Все письма <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Загрузка...</p>
      ) : emails.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg">
          <Mail className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-600 text-sm">Нет писем по этой сделке</p>
          {contactEmail && (
            <button onClick={() => setCompose(true)} className="text-blue-400 text-xs hover:underline mt-1">
              Написать на {contactEmail}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => (
            <div key={email.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
              !email.is_read && email.direction === 'inbound' ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-800'
            }`}>
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300 flex-shrink-0">
                {(email.from_name || email.from_email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {email.direction === 'outbound' ? '→ Исходящее' : (email.from_name || email.from_email)}
                  </span>
                  <span className="text-xs text-gray-600 flex-shrink-0">{formatDate(email.received_at ?? email.sent_at)}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">{email.subject}</p>
                <p className="text-xs text-gray-600 truncate">{email.body_text?.slice(0, 100)}</p>
              </div>
              {email.direction === 'inbound' && (
                <button onClick={() => setReplyTo(email)}
                  className="flex-shrink-0 p-1.5 text-gray-600 hover:text-blue-400 transition-colors" title="Ответить">
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {compose && (
        <ComposeModal
          onClose={() => setCompose(false)}
          onSent={() => { setCompose(false); load() }}
          defaultTo={contactEmail ?? ''}
          dealId={dealId}
        />
      )}

      {replyTo && (
        <ComposeModal
          onClose={() => setReplyTo(null)}
          onSent={() => { setReplyTo(null); load() }}
          defaultTo={replyTo.from_email}
          defaultSubject={replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`}
          dealId={dealId}
          inReplyTo={replyTo.id}
        />
      )}
    </div>
  )
}

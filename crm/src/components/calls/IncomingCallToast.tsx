'use client'

/**
 * c024 Sub-task 5 — IncomingCallToast.
 *
 * Subscribes to Supabase Realtime channel `crm-incoming-calls` and pops a
 * toast notification when an inbound PSTN call hits Voximplant +
 * webhook fires. Manager sees: «📞 ООО Ромашка (Иван Петров) — открыть».
 *
 * Mounted inside dashboard layout (server component cannot hold realtime
 * subscriptions, so it's a client component dropped в server layout).
 *
 * Realtime broadcast schema (sent by main site /api/voximplant/webhook):
 *   {
 *     event: 'incoming_call',
 *     payload: {
 *       call_id: string,
 *       from_number: string,
 *       to_number: string,
 *       duration: number,
 *       recording_url: string | null,
 *       contact: { id, full_name, company_name } | null,
 *       at: ISO timestamp
 *     }
 *   }
 *
 * Phase A (this version): single inline floating toast, no queue, persists
 * 30s or until user dismiss/click.
 * Phase B (next): toast queue, sound, multi-call display.
 */

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface IncomingCall {
  call_id: string
  from_number: string
  to_number: string
  duration: number
  contact: { id: string; full_name: string | null; company_name: string | null } | null
  at: string
}

function maskPhone(phone: string): string {
  // +79038095053 → +7 (903) ***-**-53
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  const last2 = digits.slice(-2)
  const code = digits.slice(-10, -7)
  return `+${digits[0]} (${code}) ***-**-${last2}`
}

export default function IncomingCallToast() {
  const [active, setActive] = useState<IncomingCall | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const channel = supabase
      .channel('crm-incoming-calls')
      .on('broadcast', { event: 'incoming_call' }, (msg) => {
        const p = msg.payload as IncomingCall
        if (p?.call_id) setActive(p)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(null), 30000)
    return () => clearTimeout(t)
  }, [active])

  if (!active) return null

  const title = active.contact?.full_name
    ? active.contact.full_name
    : maskPhone(active.from_number)
  const subtitle = active.contact?.company_name ?? 'Новый номер — добавить лид?'

  return (
    <div
      className="fixed top-4 right-4 z-50 bg-white border border-emerald-300 rounded-xl shadow-lg p-4 w-80 animate-pulse-slow"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide mb-1">
            📞 Входящий звонок
          </div>
          <div className="text-[13px] font-semibold text-gray-900 truncate">{title}</div>
          <div className="text-[11px] text-gray-600 truncate mt-0.5">{subtitle}</div>
        </div>
        <button
          onClick={() => setActive(null)}
          className="text-gray-400 hover:text-gray-700 text-[14px] leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {active.contact?.id ? (
          <a
            href={`/contacts/${active.contact.id}`}
            className="text-[11px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
          >
            Открыть карточку
          </a>
        ) : (
          <a
            href={`/contacts?phone=${encodeURIComponent(active.from_number)}`}
            className="text-[11px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
          >
            Создать контакт
          </a>
        )}
        <a
          href={`/calls?call_id=${active.call_id}`}
          className="text-[11px] bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
        >
          К звонку
        </a>
      </div>
    </div>
  )
}

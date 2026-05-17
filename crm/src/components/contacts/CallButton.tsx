'use client'

/**
 * CRM CallButton — кнопка для server-initiated outbound «callback» через
 * Voximplant. Manager нажимает → backend triggers Voximplant scenario,
 * Voximplant сначала звонит manager'у на его mobile (Sergey's phone),
 * после answer'а — соединяет с client phone. Запись + webhook на
 * harlansteel.ru/api/voximplant/webhook.
 *
 * Phase A version (c024) — minimal UX:
 *   - Single «📞 CRM Звонок» button.
 *   - Click → POST /api/voximplant/call (CRM proxy).
 *   - Toast/alert on success/failure.
 *
 * Phase B (next ТЗ) — full UX:
 *   - Modal с status (calling manager / calling client / connected / ended)
 *   - Per-manager phone из admin_users.phone (multi-manager support)
 *   - Live updates через Realtime (call status changes)
 */

import { useState } from 'react'

interface Props {
  clientPhone: string | null
  contactId?: string
}

const E164 = /^\+\d{10,15}$/

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  // 10-digit RU number → prepend +7
  if (digits.length === 10 && digits[0] === '9') return '+7' + digits
  // 11 digits starting с 8 → swap to +7
  if (digits.length === 11 && digits[0] === '8') return '+7' + digits.slice(1)
  // 11 digits с 7 → +7...
  if (digits.length === 11 && digits[0] === '7') return '+' + digits
  // already E.164-ish
  if (raw.startsWith('+') && /^\+\d{10,15}$/.test(raw)) return raw
  return null
}

export default function CallButton({ clientPhone, contactId }: Props) {
  const [calling, setCalling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const normalized = normalizePhone(clientPhone)

  async function handleCall() {
    if (!normalized || !E164.test(normalized)) {
      setError('Неверный формат телефона')
      return
    }
    setCalling(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/voximplant/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_phone: normalized,
          contact_id: contactId ?? null,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        return
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setCalling(false)
    }
  }

  if (!normalized) return null

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleCall}
        disabled={calling}
        title={`Сначала позвонит вам на менеджерский номер, потом соединит с ${normalized}`}
        className="text-[10px] bg-emerald-600 text-white border border-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait"
      >
        {calling ? '⏳ Дозваниваюсь…' : '📞 CRM Звонок'}
      </button>
      {error && (
        <span className="text-[10px] text-red-600 mt-0.5" role="alert">
          {error}
        </span>
      )}
      {success && (
        <span className="text-[10px] text-emerald-700 mt-0.5">
          ✓ Voximplant вызов запущен — ответьте на свой мобильный
        </span>
      )}
    </div>
  )
}

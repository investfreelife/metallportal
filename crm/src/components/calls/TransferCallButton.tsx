'use client'

/**
 * c026 — Mid-call transfer button.
 *
 * Manager во время активного inbound forward'а нажимает «↪ Перевести» →
 * выбирает цель → POST /api/voximplant/transfer → backend setflag'ает
 * pending_transfer_phone. Когда manager leg disconnect'ится (можно
 * вручную повесить — Voximplant scenario detect'ит), scenario re-route'ит
 * caller к новому manager phone.
 *
 * Phase 1 lacks true mid-call interrupt: manager должен сначала повесить
 * свой leg (или дождаться disconnect), потом scenario picks up. UI
 * messaging это и говорит. Phase 2 (c027) — proper VoxEngine bridge swap.
 */

import { useEffect, useState } from 'react'

interface Manager {
  id: string
  user_id: string | null
  phone_e164: string
  display_name: string | null
  status: string
  is_primary_fallback: boolean
}

interface Group {
  id: string
  name: string
  algorithm: string
  member_count: number
}

export default function TransferCallButton({
  callId,
  visible = true,
}: {
  callId: string
  visible?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [managers, setManagers] = useState<Manager[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch('/api/managers/available')
      .then((r) => r.json())
      .then((d: { managers: Manager[]; groups: Group[] }) => {
        setManagers(d.managers ?? [])
        setGroups(d.groups ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'load failed'))
      .finally(() => setLoading(false))
  }, [open])

  async function transfer(target: { user_id: string | null; phone: string; label: string }) {
    if (!confirm(`Перевести звонок на ${target.label}?\n\nВнимание: текущий менеджер должен повесить трубку — Voximplant scenario re-route'ит звонок на следующего после disconnect manager-leg.`)) return
    setError(null)
    setSuccess(null)
    try {
      const r = await fetch('/api/voximplant/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          transfer_to_user_id: target.user_id ?? null,
          transfer_to_phone: target.phone,
        }),
      })
      const j = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`)
        return
      }
      setSuccess(`Перевод на ${target.label} запланирован`)
      setTimeout(() => setOpen(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    }
  }

  if (!visible) return null

  return (
    <div className="inline-block relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100"
      >
        ↪ Перевести
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-300 rounded-xl shadow-lg z-30 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-medium text-gray-900">Перевести звонок</div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-700 text-[14px] leading-none"
            >
              ×
            </button>
          </div>

          {loading && <div className="text-[10px] text-gray-500 py-2">Загружаю менеджеров…</div>}
          {error && (
            <div className="text-[10px] text-red-600 py-1.5 mb-1.5">⚠ {error}</div>
          )}
          {success && (
            <div className="text-[10px] text-emerald-700 py-1.5 mb-1.5">✓ {success}</div>
          )}

          {!loading && managers.length > 0 && (
            <div className="space-y-1 mb-2">
              <div className="text-[9px] text-gray-400 uppercase mb-1">Менеджеры</div>
              {managers.map((m) => (
                <button
                  key={m.id}
                  onClick={() =>
                    transfer({
                      user_id: m.user_id,
                      phone: m.phone_e164,
                      label: m.display_name ?? m.phone_e164,
                    })
                  }
                  disabled={m.status !== 'available'}
                  className="w-full text-left text-[11px] bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.display_name ?? '—'}</span>
                    <span className={`text-[9px] ${m.status === 'available' ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {m.status === 'available' ? '● online' : `● ${m.status}`}
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{m.phone_e164}</div>
                </button>
              ))}
            </div>
          )}

          {!loading && groups.length > 0 && groups.some((g) => g.member_count > 0) && (
            <div className="space-y-1 border-t border-gray-100 pt-2">
              <div className="text-[9px] text-gray-400 uppercase mb-1">Группы</div>
              {groups
                .filter((g) => g.member_count > 0)
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => alert('Group transfer — phase 2 (c027)')}
                    disabled
                    className="w-full text-left text-[11px] bg-gray-50 px-2.5 py-1.5 rounded-lg opacity-50"
                  >
                    👥 {g.name} ({g.member_count} чел., {g.algorithm})
                  </button>
                ))}
            </div>
          )}

          {!loading && managers.length === 0 && (
            <div className="text-[10px] text-gray-500 py-2">
              Нет доступных менеджеров.{' '}
              <a href="/settings" className="text-blue-600 underline">
                Настроить
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

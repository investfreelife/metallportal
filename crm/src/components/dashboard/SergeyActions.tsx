'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * SergeyActions — Section 8 «От тебя ожидают действий».
 *
 * Sergey directive 2026-05-17: «кто отвечает за актуальность? кто проверяет?
 * где хранится прогресс?» — теперь:
 *   - Список из БД (sergey_actions table) — single source of truth
 *   - Каждая action имеет owner_agent (sergey / pavel / иван / алексей)
 *   - Auto-check method (sql_query / metrika_visits / tg_channel / http_get / yc_address)
 *   - last_checked_at + last_check_result показаны в UI
 *   - History в sergey_actions_log table (trigger logs status changes)
 *   - Realtime sync: галочка с iPhone мгновенно появляется на desktop
 *
 * Status flow:
 *   pending → in_progress → done (manual или auto-resolved)
 *               ↓
 *            blocked (если что-то не получается)
 *
 * Mark-done: POST /api/sergey-actions/[id]/status с x-agent-token.
 * Re-check: POST /api/sergey-actions/[id]/check — runs auto-check now.
 */

interface SergeyAction {
  id: number
  slug: string
  title: string
  description: string
  priority: 'urgent' | 'this_week' | 'backlog'
  category: string | null
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'wont_do'
  done_at: string | null
  done_by: string | null
  blocked_reason: string | null
  owner_agent: string
  owner_role: string | null
  check_method: string
  check_params: Record<string, any> | null
  check_interval_hours: number | null
  last_checked_at: string | null
  last_check_result: { done?: boolean; evidence?: string; raw?: any } | null
  auto_resolved_at: string | null
  action_label: string | null
  action_url: string | null
  copy_text: string | null
  estimated_minutes: number | null
  created_at: string
  updated_at: string
}

const PRIORITY_STYLES: Record<SergeyAction['priority'], { label: string; emoji: string; color: string; bg: string }> = {
  urgent:    { label: 'Сегодня (важно)', emoji: '🔴', color: 'text-red-700',   bg: 'bg-red-50' },
  this_week: { label: 'На этой неделе',  emoji: '🟡', color: 'text-amber-700', bg: 'bg-amber-50' },
  backlog:   { label: 'Бэклог',          emoji: '🟢', color: 'text-green-700', bg: 'bg-green-50' },
}

const OWNER_EMOJI: Record<string, string> = {
  sergey: '👤',
  pavel: '🛠',
  павел: '🛠',
  иван: '⚙️',
  алексей: '🎯',
  юля: '📝',
  антон: '📊',
  катя: '📷',
  никита: '🔍',
  михаил: '🧭',
}

const CHECK_METHOD_LABEL: Record<string, string> = {
  none: 'вручную',
  sql_query: 'SQL запрос',
  metrika_visits: 'Я.Метрика API',
  yc_address: 'Yandex Cloud API',
  voximplant_balance: 'Voximplant API',
  tg_channel: 'Telegram API',
  http_get: 'HTTP запрос',
}

function timeAgoRu(iso: string | null): string {
  if (!iso) return 'никогда'
  const ageMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ageMs / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'} назад`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад`
}

// Browser uses session cookie (auto-included in fetch). CLI uses x-agent-token.

export function SergeyActions() {
  const [actions, setActions] = useState<SergeyAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  async function fetchActions() {
    setError(null)
    try {
      const res = await fetch('/api/sergey-actions', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setActions((data.actions ?? []) as SergeyAction[])
    } catch (e: any) {
      setError(e?.message ?? 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActions()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('sergey_actions_feed')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'sergey_actions' },
        () => fetchActions()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function updateStatus(action: SergeyAction, newStatus: SergeyAction['status']) {
    setBusyId(action.id)
    try {
      const res = await fetch(`/api/sergey-actions/${action.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, done_by: 'sergey' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchActions()
    } catch (e: any) {
      alert(`Не получилось обновить: ${e?.message}`)
    } finally {
      setBusyId(null)
    }
  }

  async function runCheck(action: SergeyAction) {
    setBusyId(action.id)
    try {
      const res = await fetch(`/api/sergey-actions/${action.id}/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await fetchActions()
    } catch (e: any) {
      alert(`Проверка не прошла: ${e?.message}`)
    } finally {
      setBusyId(null)
    }
  }

  function copyToClipboard(id: number, text: string) {
    try {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  if (loading) {
    return (
      <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-[12px] text-gray-500">
        Загружаю задачи...
      </section>
    )
  }

  if (error) {
    return (
      <section className="bg-red-50 border border-red-200 rounded-xl p-4 text-[12px] text-red-700">
        Ошибка загрузки задач: {error}
      </section>
    )
  }

  const active = actions.filter((a) => a.status !== 'done' && a.status !== 'wont_do')
  const done = actions.filter((a) => a.status === 'done')

  const grouped: Record<SergeyAction['priority'], SergeyAction[]> = {
    urgent: active.filter((a) => a.priority === 'urgent'),
    this_week: active.filter((a) => a.priority === 'this_week'),
    backlog: active.filter((a) => a.priority === 'backlog'),
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">От тебя ожидают действий</h2>
        <span className="text-[11px] text-gray-400">
          {active.length} активных · {done.length} сделано
        </span>
      </div>

      {active.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-[14px] text-green-800 font-medium">Все задачи закрыты!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {(['urgent', 'this_week', 'backlog'] as const).map((prio) => {
            const items = grouped[prio]
            if (items.length === 0) return null
            const style = PRIORITY_STYLES[prio]
            return (
              <div key={prio} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className={`px-4 py-2 ${style.bg} border-b border-gray-100`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${style.color}`}>
                    {style.emoji} {style.label} · {items.length}
                  </span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {items.map((action) => {
                    const ownerEmoji = OWNER_EMOJI[action.owner_agent.toLowerCase()] || '👤'
                    const isOpen = expandedId === action.id
                    const isBusy = busyId === action.id
                    const checkMethod = CHECK_METHOD_LABEL[action.check_method] || action.check_method
                    const autoChecked = action.check_method !== 'none'
                    const lastCheckEvidence = action.last_check_result?.evidence

                    return (
                      <li key={action.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => updateStatus(action, 'done')}
                            disabled={isBusy}
                            className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 hover:border-blue-500 flex-shrink-0 transition-colors disabled:opacity-50"
                            title="Отметить выполнено"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-[13px] font-medium text-gray-900 leading-snug">
                                {action.title}
                              </span>
                              <span
                                className="text-[10px] text-gray-500 inline-flex items-center gap-1"
                                title={`Отвечает: ${action.owner_role || action.owner_agent}`}
                              >
                                {ownerEmoji} <span className="capitalize">{action.owner_agent}</span>
                              </span>
                            </div>
                            <div className="text-[12px] text-gray-600 mt-0.5 leading-snug">{action.description}</div>

                            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px]">
                              {action.action_url && (
                                <a
                                  href={action.action_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  {action.action_label || 'Открыть'} →
                                </a>
                              )}
                              {action.copy_text && (
                                <button
                                  onClick={() => copyToClipboard(action.id, action.copy_text!)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {copiedId === action.id ? '✓ скопировано' : 'Скопировать текст'}
                                </button>
                              )}
                              {action.estimated_minutes && (
                                <span className="text-gray-400">~{action.estimated_minutes} мин</span>
                              )}
                              {autoChecked && (
                                <span className="text-gray-500" title={`Auto-check method: ${checkMethod}`}>
                                  🔄 авто-проверка {action.last_checked_at ? timeAgoRu(action.last_checked_at) : 'не запускалась'}
                                </span>
                              )}
                              <button
                                onClick={() => setExpandedId(isOpen ? null : action.id)}
                                className="text-gray-500 hover:text-gray-700 ml-auto"
                              >
                                {isOpen ? 'скрыть детали' : 'детали'}
                              </button>
                            </div>

                            {isOpen && (
                              <div className="mt-2 pl-0 space-y-2 text-[11px]">
                                <div className="bg-gray-50 rounded p-2 space-y-1">
                                  <div>
                                    <span className="font-semibold text-gray-700">Кто отвечает:</span>{' '}
                                    {ownerEmoji} {action.owner_role || action.owner_agent}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700">Как проверяется:</span>{' '}
                                    {autoChecked ? (
                                      <>
                                        автоматически через <span className="font-mono">{checkMethod}</span>{' '}
                                        каждые {action.check_interval_hours ?? 24}ч
                                      </>
                                    ) : (
                                      'только вручную (ты ставишь галочку)'
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700">Последняя проверка:</span>{' '}
                                    {action.last_checked_at ? (
                                      <>
                                        {timeAgoRu(action.last_checked_at)}{' '}
                                        {lastCheckEvidence && (
                                          <span className="italic text-gray-600">— {lastCheckEvidence}</span>
                                        )}
                                      </>
                                    ) : (
                                      'ещё не проверялось'
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700">Прогресс хранится:</span>{' '}
                                    sergey_actions table (Supabase) + audit log
                                  </div>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                  {autoChecked && (
                                    <button
                                      onClick={() => runCheck(action)}
                                      disabled={isBusy}
                                      className="px-2 py-1 text-[11px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                                    >
                                      🔄 Перепроверить сейчас
                                    </button>
                                  )}
                                  {action.status !== 'in_progress' && (
                                    <button
                                      onClick={() => updateStatus(action, 'in_progress')}
                                      disabled={isBusy}
                                      className="px-2 py-1 text-[11px] bg-amber-50 text-amber-700 rounded hover:bg-amber-100 disabled:opacity-50"
                                    >
                                      ⏳ В работе
                                    </button>
                                  )}
                                  <button
                                    onClick={() => updateStatus(action, 'blocked')}
                                    disabled={isBusy}
                                    className="px-2 py-1 text-[11px] bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                                  >
                                    🚫 Заблокировано
                                  </button>
                                  <button
                                    onClick={() => updateStatus(action, 'wont_do')}
                                    disabled={isBusy}
                                    className="px-2 py-1 text-[11px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                                  >
                                    ✗ Не делаем
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDone(!showDone)}
            className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-[12px] text-gray-700">✓ Сделано · {done.length}</span>
            <span className="text-[11px] text-gray-400">{showDone ? '▴' : '▾'}</span>
          </button>
          {showDone && (
            <ul className="divide-y divide-gray-50">
              {done.map((action) => (
                <li key={action.id} className="px-4 py-2 flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded bg-green-100 border-2 border-green-500 flex items-center justify-center text-green-700 text-[10px] font-bold flex-shrink-0">
                    ✓
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-gray-600 line-through">{action.title}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {action.done_by === 'auto-check' ? '🔄 авто-проверка' : `${action.done_by || 'sergey'}`}
                      {action.done_at && ` · ${timeAgoRu(action.done_at)}`}
                    </div>
                  </div>
                  <button
                    onClick={() => updateStatus(action, 'pending')}
                    className="text-[10px] text-blue-600 hover:underline"
                    title="Открыть снова"
                  >
                    отменить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

export default SergeyActions

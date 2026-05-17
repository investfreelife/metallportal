'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * RoadmapSection — Section «📊 План и результаты».
 *
 * URGENT 2026-05-17 ROADMAP_SECTION. Sergey directive «сделай в CRM план
 * с результатами и будем сверять». Single source of truth для project
 * progress: 26 milestones в 5 horizons (today/week/month/quarter/year).
 *
 * Data: `roadmap_milestones` table (migration 20260517200000).
 * Realtime: postgres_changes channel `roadmap_realtime` — изменения
 * status / current_value сразу отражаются в UI.
 *
 * Auto-update: `scripts/check_milestones.sh` cron (6h) пересчитывает
 * current_value через CLI методы (articles_count / http_get / sql_query /
 * yc_address / metrika_visits / voximplant_balance / prs_merged /
 * agent_events_count).
 */

interface Milestone {
  id: number
  slug: string
  title: string
  description: string | null
  horizon: 'today' | 'week' | 'month' | 'quarter' | 'year'
  priority: number
  target_value: number | null
  target_unit: string | null
  target_label: string | null
  deadline: string | null
  current_value: number | null
  current_label: string | null
  progress_percent: number | null
  status: 'not_started' | 'in_progress' | 'on_track' | 'behind' | 'done' | 'blocked'
  check_method: string
  check_params: Record<string, any> | null
  last_checked_at: string | null
  last_check_result: Record<string, any> | null
  owner_agent: string | null
  owner_role: string | null
  notes: string | null
}

const HORIZONS = [
  { key: 'today',   label: 'Сегодня',                 icon: '🕐' },
  { key: 'week',    label: 'Эта неделя',              icon: '🕒' },
  { key: 'month',   label: 'Этот месяц',              icon: '🕓' },
  { key: 'quarter', label: 'Q3 2026',                 icon: '🕕' },
  { key: 'year',    label: '🎯 К маю 2027 (North Star)', icon: '🎯' },
] as const

const STATUS_STYLES: Record<Milestone['status'], { bg: string; text: string; bar: string; icon: string; label: string }> = {
  not_started: { bg: 'bg-gray-50',    text: 'text-gray-600',    bar: 'bg-gray-400',   icon: '⚪', label: 'не начато' },
  in_progress: { bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-500',   icon: '🟡', label: 'в работе' },
  on_track:    { bg: 'bg-green-50',   text: 'text-green-700',   bar: 'bg-green-500',  icon: '🟢', label: 'идём по плану' },
  behind:      { bg: 'bg-orange-50',  text: 'text-orange-700',  bar: 'bg-orange-500', icon: '🟠', label: 'отстаём' },
  done:        { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500',icon: '✅', label: 'сделано' },
  blocked:     { bg: 'bg-red-50',     text: 'text-red-700',     bar: 'bg-red-500',    icon: '🚫', label: 'заблокировано' },
}

const OWNER_EMOJI: Record<string, string> = {
  sergey: '👤', алексей: '🎯', иван: '⚙️', юля: '📝', юлия: '📝',
  антон: '📊', катя: '📷', никита: '🔍', павел: '🛠', pavel: '🛠', михаил: '🧭',
}

function fmtDeadlineDays(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `просрочен ${Math.abs(days)} д.`, color: 'text-red-600' }
  if (days === 0) return { label: 'сегодня дедлайн', color: 'text-amber-700' }
  if (days <= 3) return { label: `D-${days}`, color: 'text-amber-700' }
  return { label: `D-${days}`, color: 'text-gray-500' }
}

function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString('ru-RU')
}

export function RoadmapSection() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let unmounted = false

    supabase
      .from('roadmap_milestones')
      .select('*')
      .order('horizon', { ascending: true })
      .order('priority', { ascending: true })
      .then(({ data, error: err }: { data: Milestone[] | null; error: any }) => {
        if (unmounted) return
        if (err) setError(err.message)
        else setMilestones(data || [])
        setLoading(false)
      })

    const channel = supabase
      .channel('roadmap_realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'roadmap_milestones' },
        (payload: any) => {
          const { eventType, new: newRow, old: oldRow } = payload
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            setMilestones((prev) => {
              const idx = prev.findIndex((m) => m.id === newRow.id)
              if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = newRow as Milestone
                return copy
              }
              return [...prev, newRow as Milestone]
            })
          } else if (eventType === 'DELETE') {
            setMilestones((prev) => prev.filter((m) => m.id !== oldRow.id))
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setConnected(true)
      })

    return () => {
      unmounted = true
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-4 text-[12px] text-gray-500">
        Загружаю план...
      </section>
    )
  }

  if (error) {
    return (
      <section className="bg-red-50 border border-red-200 rounded-xl p-4 text-[12px] text-red-700">
        Ошибка загрузки плана: {error}
      </section>
    )
  }

  const byHorizon = HORIZONS.map((h) => ({
    ...h,
    items: milestones
      .filter((m) => m.horizon === h.key)
      .sort((a, b) => a.priority - b.priority),
  }))

  const totalDone = milestones.filter((m) => m.status === 'done').length
  const totalAll = milestones.length

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📊 План и результаты
            <span
              className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
              title={connected ? 'Realtime подключён' : 'Realtime отключён'}
            />
          </h2>
          <span className="text-[11px] text-gray-500">
            {totalDone} из {totalAll} сделано · 5 горизонтов · auto-update каждые 6ч
          </span>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Цели и прогресс — single source of truth. CLI cron пересчитывает current_value автоматически.
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {byHorizon.map((group) => (
          <HorizonGroup key={group.key} group={group} />
        ))}
      </div>
    </section>
  )
}

function HorizonGroup({ group }: { group: { key: string; label: string; icon: string; items: Milestone[] } }) {
  // Expand today + week by default; collapse longer horizons
  const [expanded, setExpanded] = useState(group.key === 'today' || group.key === 'week')

  const total = group.items.length
  const done = group.items.filter((i) => i.status === 'done').length
  const inProgress = group.items.filter((i) => ['in_progress', 'on_track'].includes(i.status)).length
  const blocked = group.items.filter((i) => i.status === 'blocked').length
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{group.icon}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900">{group.label}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {done}/{total} сделано · {inProgress} в работе
              {blocked > 0 && <span className="text-red-600"> · {blocked} blocked</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden md:block">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="text-[11px] text-gray-400 tabular-nums w-8 text-right">{completionPct}%</span>
          <span className="text-gray-400 text-[12px]">{expanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          {group.items.length === 0 ? (
            <div className="text-[12px] text-gray-400 italic p-3">Нет milestones в этом горизонте</div>
          ) : (
            group.items.map((m) => <MilestoneRow key={m.id} milestone={m} />)
          )}
        </div>
      )}
    </div>
  )
}

function MilestoneRow({ milestone: m }: { milestone: Milestone }) {
  const [expanded, setExpanded] = useState(false)
  const style = STATUS_STYLES[m.status] ?? STATUS_STYLES.not_started

  const progress = (() => {
    if (m.progress_percent !== null && m.progress_percent !== undefined) return Math.min(100, m.progress_percent)
    if (m.target_value && m.current_value !== null && m.current_value !== undefined) {
      return Math.min(100, Math.round((Number(m.current_value) / Number(m.target_value)) * 100))
    }
    return 0
  })()

  const deadline = fmtDeadlineDays(m.deadline)
  const ownerEmoji = m.owner_agent ? OWNER_EMOJI[m.owner_agent.toLowerCase()] || '👤' : null
  const lastCheckAgo = m.last_checked_at
    ? Math.round((Date.now() - new Date(m.last_checked_at).getTime()) / 60000)
    : null

  return (
    <div className={`rounded-lg border p-3 ${style.bg}`} style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base flex-shrink-0">{style.icon}</span>
            <span className="text-[13px] font-medium text-gray-900 leading-snug">{m.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.text} bg-white/70`}>
              {style.label}
            </span>
          </div>
          <div className="text-[12px] text-gray-600 mt-1 leading-snug flex flex-wrap items-baseline gap-x-2">
            <span>
              <span className="font-mono text-gray-900">{m.current_label || fmtNumber(m.current_value) || '0'}</span>
              {' / '}
              <span className="font-mono font-semibold text-gray-900">{m.target_label || fmtNumber(m.target_value)}</span>
            </span>
            {deadline && <span className={`${deadline.color} text-[11px]`}>· {deadline.label}</span>}
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div className={`h-full transition-all ${style.bar}`} style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {m.owner_agent && (
            <span
              className="text-[10px] px-1.5 py-0.5 bg-white/70 rounded text-gray-700 inline-flex items-center gap-1"
              title={`Отвечает: ${m.owner_role || m.owner_agent}`}
            >
              {ownerEmoji} <span className="capitalize">{m.owner_agent}</span>
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-gray-700"
          >
            {expanded ? 'свернуть' : 'детали'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-[11px] text-gray-700 space-y-1.5">
          {m.description && (
            <div>
              <span className="font-semibold">Описание:</span> {m.description}
            </div>
          )}
          {m.owner_role && (
            <div>
              <span className="font-semibold">Роль:</span> {m.owner_role}
            </div>
          )}
          <div>
            <span className="font-semibold">Как проверяется:</span>{' '}
            {m.check_method === 'manual' || m.check_method === 'none' ? (
              <span className="italic text-gray-500">вручную (без автопроверки)</span>
            ) : (
              <>
                автоматически через{' '}
                <code className="bg-white/70 px-1 py-0.5 rounded text-[10px]">{m.check_method}</code>
                {lastCheckAgo !== null && (
                  <span className="ml-2 text-gray-500">
                    ({lastCheckAgo < 60 ? `${lastCheckAgo} мин назад` : `${Math.round(lastCheckAgo / 60)}ч назад`})
                  </span>
                )}
              </>
            )}
          </div>
          {m.last_check_result && Object.keys(m.last_check_result).length > 0 && (
            <div className="text-gray-500 italic">
              ↳ {JSON.stringify(m.last_check_result).slice(0, 200)}
            </div>
          )}
          {m.notes && (
            <div className="text-gray-500">
              <span className="font-semibold">Примечания:</span> {m.notes}
            </div>
          )}
          {m.deadline && (
            <div>
              <span className="font-semibold">Дедлайн:</span>{' '}
              {new Date(m.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RoadmapSection

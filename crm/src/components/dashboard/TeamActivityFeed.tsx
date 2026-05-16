'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

/**
 * TeamActivityFeed — orchestration team activity stream.
 *
 * Источник: `agent_events` table (Supabase). Realtime через postgres_changes
 * channel — каждый INSERT появляется на dashboard БЕЗ refresh.
 *
 * История: 2026-05-16 DISPATCH OPERATOR_TO_CRM (Pavel + Алексей). Sergey directive
 * «это должно быть в срм!». В одном окне CRM dashboard — заявки + маркетинг +
 * команда (этот компонент) + звонки.
 *
 * Per-agent status badge:
 *   • green  — последний event < 1ч назад (активен)
 *   • yellow — 1-4ч (standby)
 *   • red    — > 4ч (давно не было)
 *   • gray   — нет данных
 */

interface AgentEvent {
  id: number
  agent_name: string
  event_type: string
  message: string
  task_id: string | null
  commit_sha: string | null
  severity: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const AGENT_AVATARS: Record<string, { color: string; emoji: string; role: string; ring: string }> = {
  алексей: { color: 'bg-purple-500', emoji: '🎯', role: 'CTO',      ring: 'ring-purple-200' },
  иван:    { color: 'bg-blue-500',   emoji: '⚙',  role: 'Backend',  ring: 'ring-blue-200' },
  юля:     { color: 'bg-pink-500',   emoji: '📝', role: 'Контент',  ring: 'ring-pink-200' },
  юлия:    { color: 'bg-pink-500',   emoji: '📝', role: 'Контент',  ring: 'ring-pink-200' },
  антон:   { color: 'bg-orange-500', emoji: '📊', role: 'CMO',      ring: 'ring-orange-200' },
  катя:    { color: 'bg-emerald-500',emoji: '📷', role: 'Фото',     ring: 'ring-emerald-200' },
  никита:  { color: 'bg-cyan-500',   emoji: '🎨', role: 'SEO Eng',  ring: 'ring-cyan-200' },
  павел:   { color: 'bg-indigo-500', emoji: '🛠', role: 'CRM Dev',  ring: 'ring-indigo-200' },
  pavel:   { color: 'bg-indigo-500', emoji: '🛠', role: 'CRM Dev',  ring: 'ring-indigo-200' },
  михаил:  { color: 'bg-amber-500',  emoji: '🧭', role: 'CRM Lead', ring: 'ring-amber-200' },
  денис:   { color: 'bg-slate-500',  emoji: '🔍', role: 'Data QA',  ring: 'ring-slate-200' },
}

const EVENT_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  commit:     { label: 'commit',  bg: 'bg-blue-50',   text: 'text-blue-700'   },
  pulse:      { label: 'pulse',   bg: 'bg-gray-50',   text: 'text-gray-600'   },
  report:     { label: 'report',  bg: 'bg-emerald-50',text: 'text-emerald-700'},
  task_start: { label: 'старт',   bg: 'bg-indigo-50', text: 'text-indigo-700' },
  task_end:   { label: 'финиш',   bg: 'bg-purple-50', text: 'text-purple-700' },
  blocked:    { label: 'BLOCKED', bg: 'bg-red-50',    text: 'text-red-700'    },
}

function statusForAgent(lastEvent: AgentEvent | undefined): { color: string; label: string; pulse: boolean } {
  if (!lastEvent) return { color: 'bg-gray-300', label: 'нет данных', pulse: false }
  const ageMs = Date.now() - new Date(lastEvent.created_at).getTime()
  if (ageMs < 60 * 60 * 1000) return { color: 'bg-green-500', label: 'активен', pulse: true }
  if (ageMs < 4 * 60 * 60 * 1000) return { color: 'bg-yellow-500', label: 'standby', pulse: false }
  return { color: 'bg-red-500', label: 'давно не было', pulse: false }
}

function defaultMeta(name: string) {
  return { color: 'bg-gray-400', emoji: '👤', role: '', ring: 'ring-gray-200' }
}

export function TeamActivityFeed({ initialEvents = [] as AgentEvent[] }: { initialEvents?: AgentEvent[] }) {
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents)
  const [filter, setFilter] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let unmounted = false

    // Fetch latest if SSR didn't supply
    if (initialEvents.length === 0) {
      supabase
        .from('agent_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }: { data: AgentEvent[] | null }) => {
          if (!unmounted && data) setEvents(data)
        })
    }

    const channel = supabase
      .channel('agent_events_feed')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload: { new: AgentEvent }) => {
          setEvents((prev) => [payload.new, ...prev].slice(0, 50))
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setConnected(true)
      })

    return () => {
      unmounted = true
      supabase.removeChannel(channel)
    }
  }, [initialEvents.length])

  const lastPerAgent = useMemo(() => {
    return Object.entries(AGENT_AVATARS)
      .filter(([name], idx, arr) => arr.findIndex(([n]) => n === name) === idx)
      // Filter out duplicate юля/юлия rows (same role, different spelling) — keep only first
      .filter(([name]) => !['юлия', 'pavel'].includes(name))
      .map(([name, meta]) => {
        const lastEvent =
          name === 'юля'
            ? events.find((e) => e.agent_name === 'юля' || e.agent_name === 'юлия')
            : name === 'павел'
            ? events.find((e) => e.agent_name === 'павел' || e.agent_name === 'pavel')
            : events.find((e) => e.agent_name === name)
        return { name, meta, lastEvent, status: statusForAgent(lastEvent) }
      })
  }, [events])

  const visibleEvents = filter ? events.filter((e) => e.agent_name === filter) : events

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-gray-700">👥 Команда — кто что делает</span>
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
            title={connected ? 'Realtime подключён' : 'Realtime отключён'}
          />
        </div>
        <div className="flex items-center gap-2">
          {filter && (
            <button
              onClick={() => setFilter(null)}
              className="text-[11px] text-blue-600 hover:text-blue-700"
            >
              сбросить фильтр
            </button>
          )}
          <span className="text-[10px] text-gray-400">{events.length} последних</span>
        </div>
      </div>

      {/* Per-agent status row */}
      <div className="px-4 py-3 border-b border-gray-50 flex flex-wrap gap-1.5">
        {lastPerAgent.map(({ name, meta, status }) => {
          const isActive = filter === name
          return (
            <button
              key={name}
              onClick={() => setFilter(isActive ? null : name)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                isActive
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              title={`${meta.role} — ${status.label}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}
              />
              <span>{meta.emoji}</span>
              <span className="font-medium capitalize">{name}</span>
              <span className="text-gray-400">{meta.role}</span>
            </button>
          )
        })}
      </div>

      {/* Activity feed */}
      <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-50">
        {visibleEvents.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-gray-400">
            Пока тихо. События появятся как только агенты сделают commit / report / pulse.
          </div>
        )}
        {visibleEvents.map((e) => {
          const meta = AGENT_AVATARS[e.agent_name] ?? defaultMeta(e.agent_name)
          const badge = EVENT_BADGES[e.event_type] ?? { label: e.event_type, bg: 'bg-gray-50', text: 'text-gray-600' }
          const isCritical = e.severity === 'critical' || e.event_type === 'blocked'
          return (
            <div key={e.id} className={`flex items-start gap-2.5 px-4 py-2.5 ${isCritical ? 'bg-red-50/40' : ''}`}>
              <div
                className={`${meta.color} text-white rounded-full w-7 h-7 flex items-center justify-center text-xs flex-shrink-0 ring-2 ring-offset-1 ${meta.ring}`}
              >
                {meta.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[12px] font-medium capitalize text-gray-900">{e.agent_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text} font-medium`}>
                    {badge.label}
                  </span>
                  {isCritical && (
                    <span className="text-[10px] text-red-600 font-bold uppercase tracking-wide">🔴 BLOCKED</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">{formatRelativeTime(e.created_at)}</span>
                </div>
                <p className="text-[12px] text-gray-700 leading-snug mt-0.5">{e.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  {e.commit_sha && (
                    <span className="text-[10px] text-gray-400 font-mono">{e.commit_sha.slice(0, 7)}</span>
                  )}
                  {e.task_id && <span className="text-[10px] text-gray-400">task: {e.task_id}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TeamActivityFeed

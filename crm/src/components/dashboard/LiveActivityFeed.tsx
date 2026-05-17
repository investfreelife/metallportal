'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * LiveActivityFeed — Section 2 «Что происходит прямо сейчас».
 *
 * Контекст: URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE. Заменяет
 * TeamActivityFeed (которая показывала raw commit messages — Sergey не понимал).
 *
 * Каждое событие — **одно предложение на простом русском**:
 *   ❌ "wip: feat(crm): agent_events table + /api/agent-events webhook endpoint"
 *   ✅ "Pavel улучшает дашборд CRM — создал таблицу событий, 2 минуты назад"
 *
 * Realtime через Supabase channel agent_events_feed (INSERT events).
 *
 * Phase A: только agent_events. Phase B добавит visitor journeys + calls.
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

const ROLE_LABEL: Record<string, string> = {
  алексей: 'координатор',
  иван:    'разработчик',
  юля:     'автор статей',
  юлия:    'автор статей',
  антон:   'маркетолог',
  катя:    'фотограф',
  никита:  'SEO',
  павел:   'CRM разработчик',
  pavel:   'CRM разработчик',
  михаил:  'продукт-директор',
  денис:   'аудитор данных',
}

const ROLE_EMOJI: Record<string, string> = {
  алексей: '🎯',
  иван:    '⚙️',
  юля:     '📝',
  юлия:    '📝',
  антон:   '📊',
  катя:    '📷',
  никита:  '🔍',
  павел:   '🛠',
  pavel:   '🛠',
  михаил:  '🧭',
  денис:   '🔎',
}

function timeAgoRu(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ageMs / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'} назад`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад`
}

/**
 * humanize() — превращает raw agent_event в одно русское предложение.
 *
 * Стратегия: пытаемся распознать pattern в `message` (commit prefix,
 * "wip:", "feat:", "fix:", "auto_checkpoint", и т.д.) и переводим в
 * человеческое описание ЧТО агент делает + ЗАЧЕМ если очевидно.
 *
 * Fallback: показываем agent + первые 100 символов message без emoji.
 */
function humanize(e: AgentEvent): { sentence: string; tone: 'normal' | 'blocked' | 'progress' } {
  const agent = (e.agent_name || '').toLowerCase()
  const role = ROLE_LABEL[agent] ?? 'агент'
  const emoji = ROLE_EMOJI[agent] ?? '👤'
  const name = e.agent_name.charAt(0).toUpperCase() + e.agent_name.slice(1)
  const msg = (e.message || '').trim()
  const time = timeAgoRu(e.created_at)

  // Critical / blocked
  if (e.severity === 'critical' || e.event_type === 'blocked') {
    return {
      sentence: `${emoji} ${name} (${role}) сообщает о блокере: ${msg.slice(0, 200)} — ${time}`,
      tone: 'blocked',
    }
  }

  // Commits — try to extract type + meaningful description
  if (e.event_type === 'commit') {
    // Strip conventional commit prefix (feat:, fix:, wip:, chore:, auto_checkpoint:)
    let body = msg
      .replace(/^auto_checkpoint\s+[^:]+:\s*/i, '')
      .replace(/^(feat|fix|wip|chore|docs|refactor|perf|test|build|ci)(\([^)]+\))?:\s*/i, '')
      .replace(/^auto:\s*checkpoint\s+\S+\s+\([^)]+\)\s*(\[skip ci\])?\s*/i, 'автосохранение работы')
      .trim()

    // Per-agent storyline
    if (agent === 'юля' || agent === 'юлия') {
      const articleMatch = body.match(/(?:статья|article|art#?\d*|art#\d+)\s*[«"']?([^«"'\n,]{5,60})[»"']?/i)
      const wordsMatch = body.match(/(\d+)\s*слов/i)
      if (articleMatch) {
        const title = articleMatch[1].trim()
        const words = wordsMatch ? ` (${wordsMatch[1]} слов)` : ''
        return {
          sentence: `${emoji} Юля пишет статью «${title}»${words} — ${time}`,
          tone: 'progress',
        }
      }
      return {
        sentence: `${emoji} Юля работает над контентом — ${body.slice(0, 120)} — ${time}`,
        tone: 'progress',
      }
    }

    if (agent === 'иван') {
      return {
        sentence: `${emoji} Иван (разработчик) сделал изменение в коде: ${body.slice(0, 140)} — ${time}`,
        tone: 'progress',
      }
    }

    if (agent === 'катя') {
      const photoMatch = body.match(/(?:фото|photo|hero|landing|cover)/i)
      if (photoMatch) {
        return {
          sentence: `${emoji} Катя добавила/обновила фото для сайта — ${body.slice(0, 120)} — ${time}`,
          tone: 'progress',
        }
      }
      return {
        sentence: `${emoji} Катя работает над дизайном — ${body.slice(0, 120)} — ${time}`,
        tone: 'progress',
      }
    }

    if (agent === 'pavel' || agent === 'павел') {
      return {
        sentence: `${emoji} Pavel улучшает CRM — ${body.slice(0, 140)} — ${time}`,
        tone: 'progress',
      }
    }

    if (agent === 'алексей') {
      return {
        sentence: `${emoji} Алексей (координатор) обновил инфраструктуру — ${body.slice(0, 140)} — ${time}`,
        tone: 'progress',
      }
    }

    if (agent === 'антон') {
      return {
        sentence: `${emoji} Антон (маркетинг) настроил рекламу/SEO — ${body.slice(0, 140)} — ${time}`,
        tone: 'progress',
      }
    }

    if (agent === 'никита') {
      return {
        sentence: `${emoji} Никита (SEO) оптимизировал страницы — ${body.slice(0, 140)} — ${time}`,
        tone: 'progress',
      }
    }

    // Fallback for unknown agent
    return {
      sentence: `${emoji} ${name} (${role}) сделал изменение: ${body.slice(0, 140)} — ${time}`,
      tone: 'normal',
    }
  }

  // Pulses (informational status updates)
  if (e.event_type === 'pulse') {
    return {
      sentence: `${emoji} ${name} (${role}): ${msg.slice(0, 180)} — ${time}`,
      tone: 'normal',
    }
  }

  // Task start
  if (e.event_type === 'task_start') {
    return {
      sentence: `${emoji} ${name} (${role}) начал новую задачу — ${time}`,
      tone: 'progress',
    }
  }

  // Task end / report
  if (e.event_type === 'task_end' || e.event_type === 'report') {
    return {
      sentence: `${emoji} ${name} (${role}) завершил задачу: ${msg.slice(0, 180)} — ${time}`,
      tone: 'normal',
    }
  }

  return {
    sentence: `${emoji} ${name} (${role}): ${msg.slice(0, 180)} — ${time}`,
    tone: 'normal',
  }
}

export function LiveActivityFeed({ initialEvents = [] as AgentEvent[] }: { initialEvents?: AgentEvent[] }) {
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents)
  const [connected, setConnected] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let unmounted = false

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
      .channel('live_activity_feed')
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

  // Group last event per agent — "Прямо сейчас работают:" (active <2h)
  const activeNow = useMemo(() => {
    const TWO_HOURS = 2 * 60 * 60 * 1000
    const seen = new Set<string>()
    return events
      .filter((e) => {
        const ageMs = Date.now() - new Date(e.created_at).getTime()
        if (ageMs > TWO_HOURS) return false
        if (seen.has(e.agent_name)) return false
        seen.add(e.agent_name)
        return true
      })
      .slice(0, 6)
  }, [events])

  const visibleEvents = showAll ? events : events.slice(0, 12)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Что происходит прямо сейчас
          <span
            className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
            title={connected ? 'Realtime подключён' : 'Realtime отключён'}
          />
        </h2>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[12px] text-blue-600 hover:text-blue-700"
        >
          {showAll ? 'свернуть' : 'показать все события'}
        </button>
      </div>

      {/* Active now (top, prominent) */}
      {activeNow.length > 0 && (
        <div className="bg-green-50/50 border border-green-200 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-green-800 mb-2 uppercase tracking-wide">
            🟢 Прямо сейчас работают
          </div>
          <ul className="space-y-1.5">
            {activeNow.map((e) => {
              const { sentence } = humanize(e)
              return (
                <li key={`active-${e.id}`} className="text-[13px] text-gray-800 leading-snug">
                  {sentence}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* All recent events feed */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between">
          <span className="text-[12px] font-medium text-gray-700">События за последние часы</span>
          <span className="text-[10px] text-gray-400">{events.length} записей</span>
        </div>
        <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
          {visibleEvents.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-gray-400">
              Пока тихо — пишут / коммитят / звонят / приходят посетители — здесь будет видно в реальном времени.
            </div>
          )}
          {visibleEvents.map((e) => {
            const { sentence, tone } = humanize(e)
            return (
              <div
                key={e.id}
                className={`px-4 py-2.5 ${tone === 'blocked' ? 'bg-red-50/40' : ''}`}
              >
                <p className="text-[13px] text-gray-800 leading-snug">{sentence}</p>
                {(e.commit_sha || e.task_id) && (
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                    {e.commit_sha && <span className="font-mono">commit {e.commit_sha.slice(0, 7)}</span>}
                    {e.task_id && <span>задача {e.task_id}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default LiveActivityFeed

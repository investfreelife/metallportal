'use client'

/**
 * Вкладка «📜 История» в карточке лида.
 * Рендерит единый таймлайн из /api/dream/leads/[slug]/timeline.
 * Источники: dream_activities + dream_link_events + dream_lead_transitions + dream_lead_comments.
 *
 * Lazy-load: расшифровка/запись звонка подтягиваются по клику (отдельный endpoint).
 */
import { useEffect, useState } from 'react'
import { fmtMsk, TZ } from '@/lib/tz'

interface Event {
  id: string
  ts: string
  type: string
  actor: string
  title: string
  body: string | null
  icon: string
  meta?: any
  source: string
}

const ACTOR_BADGE: Record<string, { emoji: string; label: string; cls: string }> = {
  robot:  { emoji: '🤖', label: 'робот',  cls: 'bg-purple-100 text-purple-700' },
  ai:     { emoji: '🤖', label: 'AI',     cls: 'bg-purple-100 text-purple-700' },
  human:  { emoji: '👤', label: 'ты',     cls: 'bg-blue-100 text-blue-700' },
  stolica:{ emoji: '👤', label: 'Sergey', cls: 'bg-blue-100 text-blue-700' },
  client: { emoji: '🙍', label: 'клиент', cls: 'bg-emerald-100 text-emerald-700' },
  system: { emoji: '⚙️', label: 'система', cls: 'bg-gray-100 text-gray-600' },
}

const FILTERS: { key: string; label: string; types: string[] }[] = [
  { key: 'all',       label: 'Всё',          types: [] },
  { key: 'calls',     label: '📞 Звонки',    types: ['call'] },
  { key: 'site',      label: '🌐 Сайт',      types: ['click','pageview','heartbeat','scroll','phone_click','cta_click','form_submit'] },
  { key: 'messages',  label: '💬 Переписка', types: ['sms','email','telegram','whatsapp','max','vk','comment'] },
  { key: 'workflow',  label: '🔄 Воронка',   types: ['transition','stage_change','qualification','reminder_set','link_sent'] },
]

// TASK_015: русские лейблы стадий для подсказок в title переходов
const STAGE_RU: Record<string, string> = {
  parsed:'Спарсен', enriching:'Идёт проверка', plan_proposed:'План готов',
  approved:'Утверждён', building:'Сборка', built:'Сайт собран', review_built:'Проверка сайта',
  for_sale:'В продаже', selling:'Продаётся', sold:'Продан', lost:'Отказ', trash:'В мусоре',
  site_ready:'Сайт готов', to_call:'К обзвону', no_answer:'Недозвон', reached:'Дозвонились',
  qualified:'Квалифицирован', link_sent:'Ссылка отправлена', negotiating:'Переговоры',
  callback:'Перезвонить', won:'Куплен', disqualified:'Не целевой',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} дн назад`
  return fmtMsk(iso, false)
}

export function HistoryTab({ leadSlug }: { leadSlug: string }) {
  const [events, setEvents] = useState<Event[] | null>(null)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [callDetails, setCallDetails] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch(`/api/dream/leads/${leadSlug}/timeline`)
      .then((r) => r.json())
      .then((j) => setEvents(j.events ?? []))
      .catch(() => setEvents([]))
  }, [leadSlug])

  async function expandCall(eventId: string, callId: string) {
    if (callDetails[eventId]) { setExpanded((p) => p === eventId ? null : eventId); return }
    setExpanded(eventId)
    const r = await fetch(`/api/dream/calls/${callId}`).catch(() => null)
    if (r?.ok) {
      const j = await r.json()
      setCallDetails((d) => ({ ...d, [eventId]: j }))
    } else {
      setCallDetails((d) => ({ ...d, [eventId]: { error: 'Звонок не найден (звонилка ещё не записала)' } }))
    }
  }

  if (events === null) return <div className="text-[13px] text-gray-400 italic p-4">Загружаю историю…</div>
  if (events.length === 0) return <div className="text-[13px] text-gray-500 italic p-4">Пока ничего не произошло — здесь появятся звонки, визиты на сайт, сообщения, смены стадии.</div>

  const active = FILTERS.find((f) => f.key === filter)!
  const filtered = active.types.length === 0
    ? events
    : events.filter((e) => active.types.includes(e.type))

  // Группируем по дням
  const byDay = new Map<string, Event[]>()
  filtered.forEach((e) => {
    const d = new Date(e.ts).toLocaleDateString('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(e)
  })

  return (
    <div>
      {/* Filter chips */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTERS.map((f) => {
          const n = f.types.length === 0 ? events.length : events.filter((e) => f.types.includes(e.type)).length
          const active = filter === f.key
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                active ? 'bg-gray-900 text-white border-gray-900 font-bold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {f.label} <span className="opacity-60 ml-0.5">{n}</span>
            </button>
          )
        })}
      </div>

      {/* Timeline (grouped by day) */}
      <div className="relative">
        {[...byDay.entries()].map(([day, evs]) => (
          <div key={day} className="mb-5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2 sticky top-0 bg-white py-1 z-10">
              {day}
            </div>
            <ul className="space-y-2 relative pl-6 border-l-2 border-gray-100">
              {evs.map((e) => {
                const a = ACTOR_BADGE[e.actor] ?? ACTOR_BADGE.system
                const isCall = e.type === 'call' && e.meta?.call_id
                const isExpanded = expanded === e.id
                return (
                  <li key={e.id} className="relative">
                    {/* Точка */}
                    <span className="absolute -left-[1.85rem] top-1.5 w-5 h-5 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-[11px]">
                      {e.icon}
                    </span>
                    <div className="bg-white border border-gray-100 rounded-lg p-2.5 hover:shadow-sm transition-shadow">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${a.cls}`}>
                          {a.emoji} {a.label}
                        </span>
                        <span className="text-[13px] font-medium text-gray-900 flex-1 truncate">{e.title}</span>
                        <time className="text-[10px] text-gray-400 flex-shrink-0" title={fmtMsk(e.ts)}>
                          {timeAgo(e.ts)}
                        </time>
                      </div>
                      {e.body && (
                        <p className="text-[12px] text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">{e.body}</p>
                      )}
                      {isCall && (
                        <button onClick={() => expandCall(e.id, e.meta.call_id)}
                          className="text-[11px] mt-2 text-blue-600 hover:underline font-medium">
                          {isExpanded ? '▴ Свернуть' : '📄 Расшифровка / 🔊 Запись'}
                        </button>
                      )}
                      {isExpanded && callDetails[e.id] && (
                        <CallDetails details={callDetails[e.id]} />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function CallDetails({ details }: { details: any }) {
  if (details.error) return <p className="text-[11px] text-red-500 italic mt-2">{details.error}</p>

  // TASK_021: все 7 полей выводов мозга — на верхнем уровне (роутер их вытянул из meta)
  const audioUrl   = details.audio_url ?? null
  const summary    = details.summary
  const whoAnswered= details.who_answered
  const outcome    = details.outcome
  const objections = details.objections
  const whatWorked = details.what_worked
  const lesson     = details.lesson
  const nextStep   = details.next_step
  const coaching   = details.coaching

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {/* 🔊 АУДИО — прокси TASK_021 */}
      {audioUrl ? (
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">🔊 Запись разговора</div>
          <audio controls src={audioUrl} className="w-full h-8" preload="none"/>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 italic">Записи нет (недозвон)</p>
      )}

      {/* 🧠 ВЫВОДЫ МОЗГА */}
      {(summary || whoAnswered || outcome) && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 space-y-1.5">
          <div className="text-[10px] font-bold text-gray-700 uppercase">🧠 Выводы мозга</div>
          {summary && <p className="text-[12px] text-gray-800">{summary}</p>}
          {(whoAnswered || outcome) && (
            <div className="text-[11px] text-gray-700 flex flex-wrap gap-x-3 gap-y-0.5">
              {whoAnswered && <span><b>Кто ответил:</b> {whoAnswered}</span>}
              {outcome     && <span><b>Итог:</b> {outcome}</span>}
            </div>
          )}
        </div>
      )}

      {Array.isArray(objections) && objections.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <div className="text-[10px] font-bold text-red-700 uppercase mb-1">🚫 Возражения</div>
          <ul className="text-[12px] text-red-900 list-disc pl-5 space-y-0.5">
            {objections.map((o: string, i: number) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}

      {whatWorked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
          <div className="text-[10px] font-bold text-emerald-700 uppercase mb-0.5">✅ Сработало</div>
          <p className="text-[12px] text-emerald-900">{whatWorked}</p>
        </div>
      )}

      {lesson && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2">
          <div className="text-[10px] font-bold text-amber-700 uppercase mb-0.5">💡 Урок</div>
          <p className="text-[12px] text-amber-900">{lesson}</p>
        </div>
      )}

      {nextStep && (
        <div className="bg-sky-50 border border-sky-200 rounded p-2">
          <div className="text-[10px] font-bold text-sky-700 uppercase mb-0.5">⏰ Следующий шаг</div>
          <p className="text-[12px] text-sky-900">{nextStep}</p>
        </div>
      )}

      {/* 🚀 КАК УЛУЧШИТЬ — самое ценное (мировой уровень) */}
      {coaching && (
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-300 rounded p-2.5">
          <div className="text-[10px] font-bold text-violet-700 uppercase mb-1">
            🚀 Как улучшить (мировой уровень)
          </div>
          <p className="text-[12px] text-violet-900 leading-relaxed whitespace-pre-wrap">{coaching}</p>
        </div>
      )}

      {Array.isArray(details.transcript) && details.transcript.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">📄 Расшифровка</div>
          <ol className="text-[11px] space-y-1.5 max-h-72 overflow-y-auto">
            {details.transcript.map((t: any, i: number) => (
              <li key={i} className={`flex gap-2 ${t.role === 'agent' ? 'text-purple-700' : 'text-gray-700'}`}>
                <span className="font-bold flex-shrink-0 w-16">{t.role === 'agent' ? '🤖 Робот:' : '🙍 Клиент:'}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

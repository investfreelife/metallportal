'use client'

/**
 * /dream/board — Sales Kanban (TASK_011 §2).
 *
 * 11 колонок sales_stage. Drag-and-drop меняет стадию через
 * POST /api/dream/leads/<slug>/stage.
 *
 * На карточке: имя/ниша/телефон, бейдж quality, ⏰ next_action,
 * 🌐 visits_count, 🔥 если горячий (visits>0+phone_click).
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { nicheMeta, nicheBadgeCls } from '@/lib/dream/niches'

interface Lead {
  id: number; slug: string; name: string; niche: string | null; phone: string | null
  rating: number | null; sales_stage: string; qualification: string
  decision_maker_name: string | null; decision_maker_phone: string | null
  preferred_channel: string | null; callback_at: string | null
  last_contact_at: string | null; last_channel: string | null; unread_count: number
  next_action_at: string | null; next_action_goal: string | null; next_action_by: string | null
  call_attempts: number
  visits_count: number; max_scroll_pct: number; total_time_on_site_sec: number
  landing_public_url: string | null
}

interface Column {
  key: string; title: string; emoji: string; bg: string; accent: string
}

const COLUMNS: Column[] = [
  { key:'site_ready',    title:'Сайт готов',    emoji:'🌐', bg:'bg-blue-50',    accent:'border-blue-200' },
  { key:'to_call',       title:'К обзвону',     emoji:'📞', bg:'bg-cyan-50',    accent:'border-cyan-200' },
  { key:'no_answer',     title:'Недозвон',      emoji:'🔇', bg:'bg-slate-50',   accent:'border-slate-300' },
  { key:'reached',       title:'Дозвонились',   emoji:'🗣', bg:'bg-indigo-50',  accent:'border-indigo-200' },
  { key:'qualified',     title:'Квалифицирован',emoji:'✅', bg:'bg-emerald-50', accent:'border-emerald-300' },
  { key:'link_sent',     title:'Ссылка отправлена', emoji:'🔗', bg:'bg-violet-50', accent:'border-violet-200' },
  { key:'negotiating',   title:'Переговоры',    emoji:'🤝', bg:'bg-amber-50',   accent:'border-amber-300' },
  { key:'callback',      title:'Перезвонить',   emoji:'⏰', bg:'bg-orange-50',  accent:'border-orange-300' },
  { key:'won',           title:'Куплен',        emoji:'💰', bg:'bg-green-100',  accent:'border-green-400' },
  { key:'lost',          title:'Отказ',         emoji:'❌', bg:'bg-red-50',     accent:'border-red-200' },
  { key:'disqualified',  title:'Не целевой',    emoji:'🚫', bg:'bg-gray-50',    accent:'border-gray-200' },
]

const CH_EMOJI: Record<string, string> = { voice:'📞', sms:'💬', telegram:'📨', whatsapp:'🟢', email:'✉️', max:'🇲', vk:'🅥' }

const AVG_DEAL = 25000

function fmtTime(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}м` : `${sec}с`
}

export function SalesBoard({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [moving, setMoving] = useState<number | null>(null)
  const [filterNiche, setFilterNiche] = useState<string>('all')

  // TASK_018: сводка по нишам
  const nicheCounts = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; emoji: string; n: number }>()
    leads.forEach((l) => {
      const m = nicheMeta(l.niche)
      if (!counts.has(m.key)) counts.set(m.key, { key: m.key, label: m.label, emoji: m.emoji, n: 0 })
      counts.get(m.key)!.n++
    })
    return Array.from(counts.values()).sort((a, b) => b.n - a.n)
  }, [leads])

  const visibleLeads = useMemo(() =>
    filterNiche === 'all' ? leads : leads.filter((l) => nicheMeta(l.niche).key === filterNiche),
    [leads, filterNiche])

  async function moveStage(lead: Lead, sales_stage: string, askReason = false) {
    let reason = ''
    if (askReason || sales_stage === 'won' || sales_stage === 'lost') {
      reason = prompt(`Стадия → ${sales_stage}. Комментарий (Enter — пропустить):`) ?? ''
    }
    setMoving(lead.id)
    const r = await fetch(`/api/dream/leads/${lead.slug}/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sales_stage, reason: reason || undefined }),
    })
    setMoving(null)
    if (r.ok) {
      setLeads((arr) => arr.map((l) => l.id === lead.id ? { ...l, sales_stage } : l))
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Не удалось')
    }
  }

  function onDrop(col: Column, e: React.DragEvent) {
    e.preventDefault(); setDragOver(null)
    const id = parseInt(e.dataTransfer.getData('text/lead-id'), 10)
    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.sales_stage === col.key) return
    moveStage(lead, col.key, ['won','lost','disqualified'].includes(col.key))
  }

  const byCol: Record<string, Lead[]> = {}
  COLUMNS.forEach((c) => { byCol[c.key] = [] })
  visibleLeads.forEach((l) => { (byCol[l.sales_stage] ??= []).push(l) })

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <h1 className="text-[20px] font-semibold">💼 Воронка продаж</h1>
        <p className="text-[12px] text-gray-500 mb-2">
          После того как сайт готов — ведём лида до продажи. <b>Перетащи</b> карточку между колонками.
        </p>
        {/* TASK_018: фильтр по нише */}
        <div className="flex gap-1.5 flex-wrap text-[11px]">
          <button onClick={() => setFilterNiche('all')}
            className={`px-2.5 py-1 rounded-full border ${filterNiche === 'all' ? 'bg-gray-900 text-white border-gray-900 font-bold' : 'bg-white text-gray-600 border-gray-200'}`}>
            Все · {leads.length}
          </button>
          {nicheCounts.map((n) => (
            <button key={n.key} onClick={() => setFilterNiche(n.key)}
              className={`px-2.5 py-1 rounded-full border ${filterNiche === n.key ? 'bg-gray-900 text-white border-gray-900 font-bold' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {n.emoji} {n.label} · {n.n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 pb-5" style={{ scrollbarGutter: 'stable' }}>
        <div className="flex gap-3 h-full" style={{ width: 'max-content' }}>
          {COLUMNS.map((col) => {
            const items = byCol[col.key] ?? []
            const potential = items.length * AVG_DEAL
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragOver((c) => c === col.key ? null : c) }}
                onDrop={(e) => onDrop(col, e)}
                className={`w-[280px] flex-shrink-0 rounded-xl border ${col.accent} ${col.bg} flex flex-col h-full overflow-hidden transition-all ${
                  dragOver === col.key ? 'ring-4 ring-blue-400 scale-[1.01]' : ''
                }`}>
                <header className="px-3 py-2.5 border-b border-black/5 flex items-baseline justify-between flex-shrink-0">
                  <h2 className="text-[12px] font-bold text-gray-800">
                    <span className="mr-1">{col.emoji}</span> {col.title}
                  </h2>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-bold tabular-nums text-gray-500">{items.length}</span>
                    {items.length > 0 && (
                      <span className="text-[9px] text-gray-400">{(potential/1000).toFixed(0)}к ₽</span>
                    )}
                  </div>
                </header>
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {items.length === 0
                    ? <div className="text-center text-[10px] text-gray-400 italic py-4">пусто</div>
                    : items.map((lead) => (
                      <article key={lead.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/lead-id', String(lead.id)); setDragging(lead.id) }}
                        onDragEnd={() => setDragging(null)}
                        className={`bg-white border border-gray-200 rounded-lg p-2.5 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${
                          dragging === lead.id ? 'opacity-40' : ''
                        } ${moving === lead.id ? 'animate-pulse' : ''}`}>
                        <Link href={`/dream/leads/${lead.slug}`} className="block">
                          <div className="text-[12px] font-semibold text-gray-900 truncate">{lead.name}</div>
                          {(() => {
                            const m = nicheMeta(lead.niche)
                            return (
                              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-0.5 ${nicheBadgeCls(m.color)}`}>
                                {m.emoji} {m.label}
                              </span>
                            )
                          })()}
                        </Link>
                        <div className="flex flex-wrap gap-1 mt-2 text-[10px]">
                          {lead.qualification === 'qualified' && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">✅ ЛПР</span>
                          )}
                          {(lead.visits_count > 0 && lead.total_time_on_site_sec > 60) && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">🔥 горячий</span>
                          )}
                          {lead.visits_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded">👁 {lead.visits_count}×{fmtTime(lead.total_time_on_site_sec)}</span>
                          )}
                          {lead.unread_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">{lead.unread_count} 🔴</span>
                          )}
                          {lead.last_channel && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">{CH_EMOJI[lead.last_channel] ?? lead.last_channel}</span>
                          )}
                        </div>
                        {(lead.decision_maker_name || lead.decision_maker_phone) && (
                          <div className="text-[10px] text-gray-600 mt-1.5">
                            ЛПР: {lead.decision_maker_name ?? ''} {lead.decision_maker_phone ?? ''}
                          </div>
                        )}
                        {lead.next_action_at && (
                          <div className="text-[10px] text-amber-700 mt-1.5">
                            ⏰ {new Date(lead.next_action_at).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                            {lead.next_action_by === 'robot' && <span className="ml-1 text-purple-600">🤖</span>}
                            {lead.next_action_goal && <div className="text-[9px] text-gray-500 truncate">{lead.next_action_goal}</div>}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="text-[10px] font-mono text-gray-700 mt-1.5">📞 {lead.phone}</div>
                        )}
                        {lead.call_attempts > 0 && (
                          <div className="text-[9px] text-gray-400 mt-1">попыток: {lead.call_attempts}</div>
                        )}
                      </article>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

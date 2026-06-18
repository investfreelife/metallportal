'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Lead {
  id: number
  slug: string
  name: string
  niche: string | null
  phone: string | null
  rating: number | null
  reviews_count: number | null
  build_status: string
  photos_count: number | null
  completeness_score: number | null
  has_blocker: boolean
  landings_total: number
  landings_chosen: number
  comments_unresolved: number
  updated_at: string
}

interface Column {
  key: string
  title: string
  emoji: string
  statuses: string[]            // build_status'ы которые попадают сюда
  next?: { to: string; label: string; need: 'sergey' | 'agent' }  // куда передавать дальше
  bg: string
  accent: string
}

const COLUMNS: Column[] = [
  {
    key: 'parsing',
    title: 'Парсинг',
    emoji: '🛰',
    statuses: ['parsed','enriching'],
    next: { to: 'plan_proposed', label: '→ На утверждение', need: 'agent' },
    bg: 'bg-slate-50', accent: 'border-slate-300',
  },
  {
    key: 'review',
    title: 'На утверждение',
    emoji: '🧩',
    statuses: ['plan_proposed'],
    next: { to: 'approved', label: '✅ Утвердить план', need: 'sergey' },
    bg: 'bg-amber-50', accent: 'border-amber-300',
  },
  {
    key: 'building',
    title: 'Производство',
    emoji: '🎨',
    statuses: ['approved','building'],
    next: { to: 'built', label: '→ Готов', need: 'agent' },
    bg: 'bg-blue-50', accent: 'border-blue-300',
  },
  {
    key: 'review_built',
    title: 'Проверка сайта',
    emoji: '🔍',
    statuses: ['built','review_built'],
    next: { to: 'for_sale', label: '✅ В продажу', need: 'sergey' },
    bg: 'bg-purple-50', accent: 'border-purple-300',
  },
  {
    key: 'selling',
    title: 'Продажа',
    emoji: '💼',
    statuses: ['for_sale','selling'],
    next: { to: 'sold', label: '💰 Продано', need: 'sergey' },
    bg: 'bg-emerald-50', accent: 'border-emerald-300',
  },
  {
    key: 'sold',
    title: 'Продано',
    emoji: '✅',
    statuses: ['sold'],
    bg: 'bg-green-100', accent: 'border-green-400',
  },
  {
    key: 'trash',
    title: 'Мусор / Отказ',
    emoji: '🗑',
    statuses: ['trash','lost'],
    next: { to: 'enriching', label: '↩️ Вернуть («всё равно делать»)', need: 'sergey' },
    bg: 'bg-red-50', accent: 'border-red-200',
  },
]

const STATUS_LABEL: Record<string, string> = {
  parsed: 'парсер', enriching: 'enrich…', plan_proposed: 'план готов',
  approved: 'апрувнут', building: 'собирается', built: 'построен',
  review_built: 'на ревью', for_sale: 'на продажу', selling: 'продаётся',
  sold: 'продан', lost: 'отказ', trash: 'в мусоре',
}

export function KanbanBoard({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial)
  const [showTrash, setShowTrash] = useState(true)
  const [moving, setMoving] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const router = useRouter()

  /**
   * Перевод лида.
   * silent=true (drag-and-drop) — без промптов кроме trash и блокера override.
   * silent=false (кнопка) — спрашивает причину если askReason.
   */
  async function transition(lead: Lead, to_status: string, label: string, askReason = false, silent = false) {
    let reason = ''
    if (to_status === 'trash') {
      reason = prompt('Причина (есть свой сайт / закрыты / др.):') ?? ''
      if (!reason) return
    } else if (askReason && !silent) {
      reason = prompt(`${label}\nКомментарий / причина (или Enter — пропустить):`) ?? ''
    } else if (lead.has_blocker && to_status !== 'trash' && to_status !== 'lost') {
      reason = prompt('На лиде блокер. Чтобы переопределить, введите причину начинающуюся со слова "override":') ?? ''
      if (!reason.toLowerCase().includes('override') && !reason.toLowerCase().includes('всё равно')) return
    }

    setMoving(lead.id)
    const r = await fetch(`/api/dream/leads/${lead.slug}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status, reason: reason || undefined }),
    })
    const j = await r.json()
    setMoving(null)
    if (j.ok) {
      setLeads((arr) => arr.map((l) => l.id === lead.id ? { ...l, build_status: to_status } : l))
    } else {
      alert(j.error || 'Не удалось')
    }
  }

  const byCol: Record<string, Lead[]> = {}
  COLUMNS.forEach((c) => { byCol[c.key] = [] })
  leads.forEach((l) => {
    const col = COLUMNS.find((c) => c.statuses.includes(l.build_status))
    if (col) byCol[col.key].push(l)
  })

  /** Drag-and-drop: куда уронить → какой целевой build_status. */
  function onDropToColumn(col: Column, e: React.DragEvent) {
    e.preventDefault()
    setDragOverCol(null)
    const idStr = e.dataTransfer.getData('text/lead-id')
    const id = parseInt(idStr, 10)
    if (!Number.isFinite(id)) return
    const lead = leads.find((l) => l.id === id)
    if (!lead) return
    if (col.statuses.includes(lead.build_status)) return  // та же колонка
    // Определяем целевой статус по drop'у:
    //  - если в колонке есть «next» — используем его to (продвижение вперёд)
    //  - иначе — первый статус колонки (например drop в Парсинг → 'parsed')
    const target = col.next?.to ?? col.statuses[0]
    // Для колонки trash и selling/sold — спрашиваем причину
    const askReason = ['sold', 'lost', 'for_sale', 'approved'].includes(target)
    transition(lead, target, col.title, askReason, /*silent*/ !askReason)
  }

  return (
    <div className="flex flex-col h-full">
      {/* шапка фиксированная */}
      <div className="flex-shrink-0 flex items-baseline justify-between px-5 pt-5 pb-3">
        <div>
          <h1 className="text-[20px] font-semibold">📊 Канбан-воронка лидов</h1>
          <p className="text-[12px] text-gray-500">
            <b>Перетащи</b> карточку в нужную колонку или жми кнопку. Карточки с 🛑 потребуют override-причину.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showTrash} onChange={(e) => setShowTrash(e.target.checked)} className="rounded"/>
          показывать «Мусор»
        </label>
      </div>

      {/* горизонтальный скролл — фишка: overflow-x-auto на КОНТЕЙНЕРЕ с явной h-[calc(...)] */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 pb-5" style={{ scrollbarGutter: 'stable' }}>
        <div className="flex gap-3 h-full" style={{ width: 'max-content' }}>
          {COLUMNS.filter((c) => showTrash || c.key !== 'trash').map((col) => {
            const items = byCol[col.key]
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
                onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragOverCol((c) => c === col.key ? null : c) }}
                onDrop={(e) => onDropToColumn(col, e)}
                className={`w-[290px] flex-shrink-0 rounded-xl border ${col.accent} ${col.bg} flex flex-col h-full overflow-hidden transition-all ${
                  dragOverCol === col.key ? 'ring-4 ring-blue-400 scale-[1.02]' : ''
                }`}>
                <header className="px-3 py-2.5 border-b border-black/5 flex items-baseline justify-between flex-shrink-0">
                  <h2 className="text-[13px] font-bold text-gray-800">
                    <span className="mr-1">{col.emoji}</span> {col.title}
                  </h2>
                  <span className="text-[11px] font-bold tabular-nums text-gray-500">{items.length}</span>
                </header>
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {items.length === 0 ? (
                    <div className="text-center text-[11px] text-gray-400 italic py-6">пусто</div>
                  ) : (
                    items.map((lead) => (
                      <article key={lead.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/lead-id', String(lead.id)); e.dataTransfer.effectAllowed = 'move'; setDragging(lead.id) }}
                        onDragEnd={() => { setDragging(null); setDragOverCol(null) }}
                        className={`bg-white border ${lead.has_blocker ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'} rounded-lg p-2.5 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${
                          dragging === lead.id ? 'opacity-40' : ''
                        }`}>
                        <Link href={`/dream/leads/${lead.slug}`} className="block">
                          <div className="text-[12px] font-semibold text-gray-900 truncate">{lead.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{lead.niche ?? '—'}</div>
                        </Link>

                        <div className="flex flex-wrap gap-1 mt-2 text-[10px]">
                          {lead.rating && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">⭐ {lead.rating}</span>
                          )}
                          {lead.photos_count != null && lead.photos_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded">📷 {lead.photos_count}</span>
                          )}
                          {lead.landings_total > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">🌐 {lead.landings_total}{lead.landings_chosen ? '✓' : ''}</span>
                          )}
                          {lead.comments_unresolved > 0 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">💬 {lead.comments_unresolved}</span>
                          )}
                          {lead.has_blocker && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">🛑 СТОП</span>
                          )}
                        </div>

                        {lead.phone && (
                          <div className="text-[10px] font-mono text-gray-600 mt-2">📞 {lead.phone}</div>
                        )}
                        <div className="text-[9px] text-gray-400 mt-1.5">статус: <span className="font-medium">{STATUS_LABEL[lead.build_status] ?? lead.build_status}</span></div>

                        <div className="flex flex-col gap-1 mt-2.5 pt-2 border-t border-gray-100">
                          {col.next && (
                            <button
                              onClick={() => transition(lead, col.next!.to, col.next!.label, col.next!.need === 'sergey')}
                              disabled={moving === lead.id}
                              className={`text-[10px] font-medium py-1 px-2 rounded transition-colors ${
                                col.next.need === 'sergey'
                                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              } disabled:opacity-50`}
                            >
                              {moving === lead.id ? '…' : col.next.label}
                            </button>
                          )}
                          {col.key !== 'trash' && col.key !== 'sold' && (
                            <button
                              onClick={() => transition(lead, 'trash', '🗑 В мусор')}
                              disabled={moving === lead.id}
                              className="text-[10px] text-gray-500 hover:text-red-600 py-0.5"
                            >🗑 в мусор</button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

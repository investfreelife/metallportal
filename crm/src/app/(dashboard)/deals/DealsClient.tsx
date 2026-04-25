'use client'
import { useState } from 'react'
import { DealCard } from './DealCard'
import { AddDealModal } from './AddDealModal'
import { DealDetailModal } from './DealDetailModal'

export const STAGES = [
  { key: 'new',         label: 'Новые',        color: '#378ADD', bg: '#E6F1FB' },
  { key: 'qualified',   label: 'Квалификация',  color: '#27A882', bg: '#E1F5EE' },
  { key: 'proposal',    label: 'КП отправлено', color: '#EF9F27', bg: '#FAEEDA' },
  { key: 'negotiation', label: 'Переговоры',    color: '#E87444', bg: '#FCEDE4' },
  { key: 'won',         label: 'Закрыто ✓',    color: '#639922', bg: '#EAF3DE' },
]

// stages not in main kanban → map to nearest
const STAGE_REMAP: Record<string, string> = {
  call: 'new', supplier_request: 'qualified', sent: 'proposal',
  delivery: 'won', completed: 'won',
}

function formatMoney(v: number) {
  if (!v) return '0 ₽'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М ₽`
  if (v >= 1_000) return `${Math.round(v / 1_000)}К ₽`
  return `${v} ₽`
}

export function DealsClient({ deals, lostDeals }: { deals: any[]; lostDeals: any[] }) {
  const [localDeals, setLocalDeals] = useState(() =>
    deals.map(d => ({ ...d, stage: STAGE_REMAP[d.stage] || d.stage }))
  )
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<any>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showLost, setShowLost] = useState(false)

  const filtered = localDeals.filter(d =>
    !search ||
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.contacts?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.contacts?.company_name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDragging(dealId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(stage)
  }

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    if (!dragging) return
    const deal = localDeals.find(d => d.id === dragging)
    if (!deal || deal.stage === newStage) { setDragging(null); setDragOver(null); return }

    setLocalDeals(prev => prev.map(d => d.id === dragging ? { ...d, stage: newStage } : d))
    setDragging(null)
    setDragOver(null)

    await fetch(`/api/deals/${dragging}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  const handleDealUpdate = (updated: any) => {
    const stage = STAGE_REMAP[updated.stage] || updated.stage
    if (updated.stage === 'lost') {
      setLocalDeals(prev => prev.filter(d => d.id !== updated.id))
    } else {
      setLocalDeals(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated, stage } : d))
    }
    setSelectedDeal(null)
  }

  const handleDealAdd = (newDeal: any) => {
    const stage = STAGE_REMAP[newDeal.stage] || newDeal.stage
    setLocalDeals(prev => [{ ...newDeal, stage }, ...prev])
    setShowAdd(false)
  }

  const handleDealDelete = (id: string) => {
    setLocalDeals(prev => prev.filter(d => d.id !== id))
    setSelectedDeal(null)
  }

  const pipelineTotal = localDeals.filter(d => d.stage !== 'won').reduce((s, d) => s + (d.amount || 0), 0)
  const wonTotal = localDeals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.amount || 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Шапка */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-medium text-gray-900">Сделки</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Pipeline: {formatMoney(pipelineTotal)} · Выиграно: {formatMoney(wonTotal)}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-blue-600 text-white text-[11px] px-4 py-2 rounded-lg hover:bg-blue-700">
            + Добавить сделку
          </button>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, клиенту..."
            className="flex-1 text-[12px] border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
          />
          <button onClick={() => setShowLost(!showLost)}
            className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${showLost ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {showLost ? 'Скрыть' : 'Показать'} проигранные ({lostDeals.length})
          </button>
        </div>
      </div>

      {/* Канбан */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-h-0" style={{ minWidth: (STAGES.length + (showLost ? 1 : 0)) * 268 + 'px' }}>
          {STAGES.map(stage => {
            const stageDeal = filtered.filter(d => d.stage === stage.key)
            const stageTotal = stageDeal.reduce((s, d) => s + (d.amount || 0), 0)
            const isOver = dragOver === stage.key

            return (
              <div key={stage.key}
                className="flex flex-col rounded-xl transition-all"
                style={{ width: 260, minWidth: 260, background: isOver ? '#EFF6FF' : '#F8FAFC', outline: isOver ? '2px solid #60A5FA' : 'none', outlineOffset: 2 }}
                onDragOver={e => handleDragOver(e, stage.key)}
                onDrop={e => handleDrop(e, stage.key)}
                onDragLeave={() => setDragOver(null)}
              >
                <div className="flex-shrink-0 px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-[11px] font-medium text-gray-800">{stage.label}</span>
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{stageDeal.length}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{formatMoney(stageTotal)}</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[200px]">
                  {stageDeal.map(deal => (
                    <DealCard key={deal.id} deal={deal} stageColor={stage.color}
                      isDragging={dragging === deal.id}
                      onDragStart={e => handleDragStart(e, deal.id)}
                      onClick={() => setSelectedDeal(deal)}
                    />
                  ))}
                  {stageDeal.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-[10px] text-gray-400">Перетащи сделку сюда</p>
                    </div>
                  )}
                  <button onClick={() => setShowAdd(true)}
                    className="w-full text-[10px] text-gray-400 hover:text-gray-600 py-1.5 hover:bg-white rounded-lg transition-colors text-left px-2">
                    + Добавить
                  </button>
                </div>
              </div>
            )
          })}

          {showLost && (
            <div className="flex flex-col rounded-xl bg-red-50" style={{ width: 260, minWidth: 260 }}>
              <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[11px] font-medium text-gray-800">Проигранные</span>
                <span className="text-[10px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded-full">{lostDeals.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[200px]">
                {lostDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} stageColor="#E24B4A"
                    isDragging={false} onDragStart={() => {}} onClick={() => setSelectedDeal(deal)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddDealModal onClose={() => setShowAdd(false)} onAdd={handleDealAdd} />}
      {selectedDeal && (
        <DealDetailModal deal={selectedDeal} onClose={() => setSelectedDeal(null)}
          onUpdate={handleDealUpdate} onDelete={handleDealDelete} />
      )}
    </div>
  )
}

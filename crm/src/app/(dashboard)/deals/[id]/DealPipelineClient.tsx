'use client'

import { useState } from 'react'
import {
  ClipboardList, Phone, Factory, FileText, Handshake,
  CreditCard, Truck, CheckCircle2, XCircle, ChevronRight,
  Sparkles, Bell, Send, Package
} from 'lucide-react'

export interface PipelineStage {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  aiAction?: string          // что ИИ делает на этом шаге
  managerTask?: string       // задача менеджеру
}

const STAGES: PipelineStage[] = [
  { id: 'new',              label: 'Новая заявка',       icon: <ClipboardList className="w-4 h-4"/>, color: 'blue',   aiAction: 'Отправить клиенту подтверждение заказа',      managerTask: 'Связаться с клиентом в течение 30 минут' },
  { id: 'call',             label: 'Контакт',            icon: <Phone className="w-4 h-4"/>,         color: 'cyan',   aiAction: 'Уточнить детали заказа и сроки',              managerTask: 'Уточнить детали заказа, сроки поставки' },
  { id: 'supplier_request', label: 'Запрос постав.',     icon: <Factory className="w-4 h-4"/>,       color: 'amber',  aiAction: 'Разослать запросы поставщикам',               managerTask: 'Собрать цены поставщиков на товары' },
  { id: 'proposal',         label: 'КП отправлено',      icon: <FileText className="w-4 h-4"/>,      color: 'purple', aiAction: 'Подготовить и отправить КП клиенту',          managerTask: 'Отправить коммерческое предложение клиенту' },
  { id: 'negotiation',      label: 'Переговоры',         icon: <Handshake className="w-4 h-4"/>,     color: 'orange', aiAction: 'Напомнить клиенту о КП через 2 дня',          managerTask: 'Обсудить условия поставки и цену' },
  { id: 'won',              label: 'Оплата',             icon: <CreditCard className="w-4 h-4"/>,    color: 'green',  aiAction: 'Выставить счёт и проверить оплату',           managerTask: 'Выставить счёт на оплату' },
  { id: 'delivery',         label: 'Доставка',           icon: <Truck className="w-4 h-4"/>,         color: 'teal',   aiAction: 'Организовать логистику и трекинг',            managerTask: 'Согласовать доставку с транспортной компанией' },
  { id: 'completed',        label: 'Завершено',          icon: <CheckCircle2 className="w-4 h-4"/>,  color: 'emerald',aiAction: 'Запросить отзыв у клиента',                   managerTask: 'Получить отзыв и зафиксировать в CRM' },
]

const COLOR_MAP: Record<string, { active: string; dot: string; text: string }> = {
  blue:    { active: 'bg-blue-500/20 border-blue-500 text-blue-300',    dot: 'bg-blue-500',    text: 'text-blue-400' },
  cyan:    { active: 'bg-cyan-500/20 border-cyan-500 text-cyan-300',    dot: 'bg-cyan-500',    text: 'text-cyan-400' },
  amber:   { active: 'bg-amber-500/20 border-amber-500 text-amber-300', dot: 'bg-amber-500',   text: 'text-amber-400' },
  purple:  { active: 'bg-purple-500/20 border-purple-500 text-purple-300', dot: 'bg-purple-500', text: 'text-purple-400' },
  orange:  { active: 'bg-orange-500/20 border-orange-500 text-orange-300', dot: 'bg-orange-500', text: 'text-orange-400' },
  green:   { active: 'bg-green-500/20 border-green-500 text-green-300', dot: 'bg-green-500',   text: 'text-green-400' },
  teal:    { active: 'bg-teal-500/20 border-teal-500 text-teal-300',    dot: 'bg-teal-500',    text: 'text-teal-400' },
  emerald: { active: 'bg-emerald-500/20 border-emerald-500 text-emerald-300', dot: 'bg-emerald-500', text: 'text-emerald-400' },
}

const AI_BUTTONS: Record<string, { label: string; icon: React.ReactNode; action: string }[]> = {
  new: [
    { label: 'Уведомить клиента', icon: <Bell className="w-3.5 h-3.5"/>, action: 'notify_customer' },
  ],
  call: [
    { label: 'Открыть диалог', icon: <Phone className="w-3.5 h-3.5"/>, action: 'open_chat' },
  ],
  supplier_request: [
    { label: 'Разослать запросы', icon: <Send className="w-3.5 h-3.5"/>, action: 'notify_suppliers' },
    { label: 'Добавить поставщика', icon: <Package className="w-3.5 h-3.5"/>, action: 'add_supplier' },
  ],
  proposal: [
    { label: 'Сформировать КП', icon: <FileText className="w-3.5 h-3.5"/>, action: 'create_proposal' },
  ],
}

export default function DealPipelineClient({
  dealId,
  initialStage,
  customerNotified,
}: {
  dealId: string
  initialStage: string
  customerNotified?: boolean
}) {
  const [stage, setStage] = useState(initialStage)
  const [saving, setSaving] = useState(false)
  const [notified, setNotified] = useState(customerNotified)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const currentIdx = STAGES.findIndex(s => s.id === stage)
  const currentStage = STAGES[currentIdx]

  const moveStage = async (newStage: string) => {
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      setStage(newStage)
    } finally { setSaving(false) }
  }

  const doAction = async (action: string) => {
    if (action === 'notify_customer') {
      const res = await fetch(`/api/deals/${dealId}/notify-customer`, { method: 'POST' })
      if (res.ok) { setNotified(true); setActionMsg('✓ Уведомление клиенту отправлено') }
    } else if (action === 'notify_suppliers') {
      setActionMsg('Перейдите в блок «Поставщики» и нажмите «Отправить запрос»')
    } else if (action === 'create_proposal') {
      setActionMsg('Открыта вкладка КП — заполните данные')
    } else {
      setActionMsg(`Действие: ${action}`)
    }
    setTimeout(() => setActionMsg(null), 4000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Stage bar */}
      <div className="px-5 pt-4 pb-2 border-b border-gray-800">
        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {STAGES.map((s, i) => {
            const isActive = s.id === stage
            const isPast = i < currentIdx
            const colors = COLOR_MAP[s.color]
            return (
              <button
                key={s.id}
                onClick={() => moveStage(s.id)}
                disabled={saving}
                title={s.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all flex-shrink-0
                  ${isActive
                    ? `${colors.active} border-current`
                    : isPast
                      ? 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'
                      : 'bg-transparent border-gray-800 text-gray-600 hover:border-gray-600 hover:text-gray-400'
                  }`}
              >
                <span className={isActive ? '' : isPast ? 'opacity-60' : 'opacity-30'}>
                  {s.icon}
                </span>
                {s.label}
                {isPast && <span className="text-gray-600">✓</span>}
              </button>
            )
          })}
          {/* Lost button */}
          <button
            onClick={() => moveStage('lost')}
            disabled={saving || stage === 'lost'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap flex-shrink-0 transition-all
              ${stage === 'lost' ? 'bg-red-500/20 border-red-500 text-red-300' : 'border-gray-800 text-gray-700 hover:border-red-800 hover:text-red-400'}`}
          >
            <XCircle className="w-3.5 h-3.5" /> Отказ
          </button>
        </div>
      </div>

      {/* AI action block for current stage */}
      {currentStage && (
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-300 text-xs font-semibold">ИИ рекомендует</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="text-gray-300 text-xs">{currentStage.aiAction}</span>
              </div>
              <p className="text-gray-500 text-xs mb-3">
                📋 Задача менеджеру: <span className="text-gray-400">{currentStage.managerTask}</span>
              </p>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {(AI_BUTTONS[stage] ?? []).map(btn => (
                  <button key={btn.action} onClick={() => doAction(btn.action)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 text-xs rounded-lg transition-colors">
                    {btn.icon} {btn.label}
                  </button>
                ))}
                {/* Customer notified badge */}
                {notified && (
                  <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs rounded-lg">
                    <Bell className="w-3.5 h-3.5" /> Клиент уведомлён
                  </span>
                )}
                {/* Next stage button */}
                {currentIdx < STAGES.length - 1 && stage !== 'lost' && (
                  <button onClick={() => moveStage(STAGES[currentIdx + 1].id)} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded-lg transition-colors ml-auto">
                    Следующий шаг <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {actionMsg && (
                <p className="mt-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {actionMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

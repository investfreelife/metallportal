'use client'

import Link from 'next/link'
import { formatCurrency, getDealStageLabel } from '@/lib/utils'
import { Plus } from 'lucide-react'

type DealRow = {
  id: string
  title: string
  amount: number | null
  currency: string
  stage: string
  ai_win_probability: number
  ai_recommendation: string | null
  expected_close_date: string | null
  contact: { id: string; full_name: string | null; company_name: string | null }[] | null
}

const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const

const STAGE_COLORS: Record<string, string> = {
  new: 'border-blue-500/40 bg-blue-500/5',
  qualified: 'border-cyan-500/40 bg-cyan-500/5',
  proposal: 'border-purple-500/40 bg-purple-500/5',
  negotiation: 'border-orange-500/40 bg-orange-500/5',
  won: 'border-green-500/40 bg-green-500/5',
  lost: 'border-red-500/40 bg-red-500/5',
}

const STAGE_HEADER_COLORS: Record<string, string> = {
  new: 'text-blue-400',
  qualified: 'text-cyan-400',
  proposal: 'text-purple-400',
  negotiation: 'text-orange-400',
  won: 'text-green-400',
  lost: 'text-red-400',
}

export default function DealsKanban({ deals }: { deals: DealRow[] }) {
  const byStage = STAGES.reduce<Record<string, DealRow[]>>((acc, stage) => {
    acc[stage] = deals.filter((d) => d.stage === stage)
    return acc
  }, {} as Record<string, DealRow[]>)

  const totalPipeline = deals
    .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    .reduce((sum, d) => sum + (d.amount ?? 0), 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Сделки</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Pipeline: {formatCurrency(totalPipeline)} · {deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').length} активных
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Новая сделка
        </button>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const stageDeal = byStage[stage]
            const stageAmount = stageDeal.reduce((sum, d) => sum + (d.amount ?? 0), 0)
            return (
              <div key={stage} className="w-72 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-sm ${STAGE_HEADER_COLORS[stage]}`}>
                      {getDealStageLabel(stage)}
                    </h3>
                    <span className="text-gray-500 text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">
                      {stageDeal.length}
                    </span>
                  </div>
                  {stageAmount > 0 && (
                    <span className="text-gray-400 text-xs">{formatCurrency(stageAmount)}</span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {stageDeal.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className={`block p-3.5 rounded-xl border ${STAGE_COLORS[stage]} hover:bg-white/5 transition-colors`}
                    >
                      <p className="text-white text-sm font-medium leading-snug">{deal.title}</p>
                      {deal.contact && deal.contact[0] && (
                        <p className="text-gray-400 text-xs mt-1">
                          {deal.contact[0].full_name || deal.contact[0].company_name}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        {deal.amount ? (
                          <span className="text-green-400 text-sm font-semibold">
                            {formatCurrency(deal.amount, deal.currency)}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-sm">—</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className="w-8 h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${deal.ai_win_probability}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-xs">{deal.ai_win_probability}%</span>
                        </div>
                      </div>
                      {deal.ai_recommendation && (
                        <p className="text-purple-300 text-xs mt-2 line-clamp-2">
                          🤖 {deal.ai_recommendation}
                        </p>
                      )}
                    </Link>
                  ))}

                  {stageDeal.length === 0 && (
                    <div className={`p-4 rounded-xl border border-dashed ${STAGE_COLORS[stage]} text-center text-gray-600 text-xs`}>
                      Пусто
                    </div>
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

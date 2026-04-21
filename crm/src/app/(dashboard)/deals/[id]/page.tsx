import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, getDealStageLabel } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  qualified: 'bg-cyan-500/20 text-cyan-300',
  proposal: 'bg-purple-500/20 text-purple-300',
  negotiation: 'bg-orange-500/20 text-orange-300',
  won: 'bg-green-500/20 text-green-300',
  lost: 'bg-red-500/20 text-red-300',
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select('*, contact:contacts(*)')
    .eq('id', id)
    .single()

  if (!deal) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/deals" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white flex-1">{deal.title}</h1>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[deal.stage] ?? ''}`}>
          {getDealStageLabel(deal.stage)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">Детали сделки</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-xs mb-1">Сумма</p>
                <p className="text-white text-xl font-bold">{formatCurrency(deal.amount, deal.currency)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Вероятность закрытия</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${deal.ai_win_probability}%` }}
                    />
                  </div>
                  <span className="text-blue-400 font-semibold text-sm">{deal.ai_win_probability}%</span>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Ожидаемое закрытие</p>
                <p className="text-gray-300 text-sm">{formatDate(deal.expected_close_date)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Создана</p>
                <p className="text-gray-300 text-sm">{formatDate(deal.created_at)}</p>
              </div>
            </div>
          </div>

          {deal.ai_recommendation && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-5">
              <p className="text-purple-300 text-xs font-medium mb-2">🤖 Рекомендация ИИ</p>
              <p className="text-gray-300 text-sm">{deal.ai_recommendation}</p>
            </div>
          )}

          {deal.lost_reason && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-5">
              <p className="text-red-400 text-xs font-medium mb-2">Причина отказа</p>
              <p className="text-gray-300 text-sm">{deal.lost_reason}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {deal.contact && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-3">Контакт</h2>
              <Link href={`/contacts/${deal.contact.id}`} className="group">
                <p className="text-blue-400 group-hover:text-blue-300 text-sm font-medium transition-colors">
                  {deal.contact.full_name || deal.contact.company_name || '—'}
                </p>
                {deal.contact.phone && (
                  <p className="text-gray-400 text-xs mt-1">{deal.contact.phone}</p>
                )}
                {deal.contact.company_name && deal.contact.full_name && (
                  <p className="text-gray-400 text-xs">{deal.contact.company_name}</p>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

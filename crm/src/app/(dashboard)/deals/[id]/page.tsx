import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DealItemsClient, { type DealItem } from './DealItemsClient'
import DealEmailsClient from './DealEmailsClient'
import DealPipelineClient from './DealPipelineClient'
import DealSuppliersClient, { type Supplier } from './DealSuppliersClient'
import DealTasksClient, { type Task } from './DealTasksClient'

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

  // Tasks — resilient: table may not exist yet
  let tasks: Task[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (supabase as any)
      .from('tasks').select('*').eq('deal_id', id).order('created_at', { ascending: false })
    tasks = Array.isArray(t) ? t : []
  } catch { /* tasks table not yet created */ }

  const items = (deal.items as DealItem[]) ?? []
  const suppliers = (deal.suppliers as Supplier[]) ?? []
  const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/deals" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{deal.title}</h1>
          {deal.amount && (
            <p className="text-gray-400 text-sm">{formatCurrency(deal.amount, deal.currency)}</p>
          )}
        </div>
      </div>

      {/* 1. Pipeline / AI actions */}
      <DealPipelineClient
        dealId={deal.id}
        initialStage={deal.stage}
        customerNotified={deal.customer_notified}
      />

      {/* 2. Items table */}
      <DealItemsClient dealId={deal.id} initialItems={items} />

      {/* 3. Supplier price grid */}
      <DealSuppliersClient dealId={deal.id} items={items} initialSuppliers={suppliers} />

      {/* 4. Tasks + Emails + Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Tasks */}
          <DealTasksClient dealId={deal.id} initialTasks={(tasks as Task[]) ?? []} />

          {/* Emails */}
          <DealEmailsClient dealId={deal.id} contactEmail={contact?.email} />
        </div>

        <div className="space-y-4">
          {/* Contact card */}
          {contact && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-3">Контакт</h2>
              <Link href={`/contacts/${contact.id}`} className="group">
                <p className="text-blue-400 group-hover:text-blue-300 text-sm font-medium transition-colors">
                  {contact.full_name || contact.company_name || '—'}
                </p>
                {contact.phone && <p className="text-gray-400 text-xs mt-1">{contact.phone}</p>}
                {contact.email && <p className="text-gray-400 text-xs">{contact.email}</p>}
              </Link>
            </div>
          )}

          {/* Deal details */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">Детали сделки</h2>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs mb-1">Вероятность</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${deal.ai_win_probability}%` }} />
                  </div>
                  <span className="text-blue-400 text-xs font-semibold">{deal.ai_win_probability}%</span>
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
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
              <p className="text-purple-300 text-xs font-medium mb-1">🤖 ИИ</p>
              <p className="text-gray-300 text-xs">{deal.ai_recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

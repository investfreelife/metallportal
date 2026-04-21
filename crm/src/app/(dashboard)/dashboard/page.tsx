import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatRelativeTime, getScoreBgColor, getActionTypeLabel } from '@/lib/utils'
import { Users, TrendingUp, Briefcase, DollarSign, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalContacts },
    { count: hotLeads },
    { count: activeDeals },
    { data: pipeline },
    { data: pendingQueue },
    { data: recentContacts },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).gt('ai_score', 60),
    supabase.from('deals').select('*', { count: 'exact', head: true }).not('stage', 'in', '("won","lost")'),
    supabase.from('deals').select('amount').not('stage', 'in', '("won","lost")'),
    supabase.from('ai_queue').select('*, contact:contacts(full_name, company_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    supabase.from('contacts').select('id, full_name, company_name, phone, ai_score, ai_segment, source, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const pipelineAmount = pipeline?.reduce((sum, d) => sum + (d.amount ?? 0), 0) ?? 0

  const metrics = [
    {
      label: 'Всего контактов',
      value: totalContacts ?? 0,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      href: '/contacts',
    },
    {
      label: 'Горячих лидов',
      value: hotLeads ?? 0,
      icon: TrendingUp,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      href: '/contacts?segment=hot',
    },
    {
      label: 'Сделок в работе',
      value: activeDeals ?? 0,
      icon: Briefcase,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      href: '/deals',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(pipelineAmount),
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      href: '/deals',
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-gray-400 text-sm mt-0.5">Обзор ключевых показателей</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} className="block">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.bg}`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-white">{m.value}</p>
              <p className="text-gray-400 text-sm mt-0.5">{m.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Очередь ИИ</h2>
            <Link href="/queue" className="text-blue-400 text-sm hover:text-blue-300 transition-colors">
              Все →
            </Link>
          </div>
          {!pendingQueue || pendingQueue.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              Нет ожидающих действий
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {pendingQueue.map((item) => {
                const contact = item.contact as { full_name?: string; company_name?: string } | null
                return (
                  <li key={item.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        item.priority === 'urgent' ? 'bg-red-500' :
                        item.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {contact?.full_name || contact?.company_name || 'Неизвестный контакт'}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {getActionTypeLabel(item.action_type)}
                        </p>
                      </div>
                      <span className="text-gray-500 text-xs flex-shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Последние контакты</h2>
            <Link href="/contacts" className="text-blue-400 text-sm hover:text-blue-300 transition-colors">
              Все →
            </Link>
          </div>
          {!recentContacts || recentContacts.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              Контактов пока нет
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {recentContacts.map((c) => (
                <li key={c.id}>
                  <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {c.full_name || c.company_name || '—'}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {c.phone || c.source || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getScoreBgColor(c.ai_score)}`}
                          style={{ width: `${c.ai_score}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs w-6 text-right">{c.ai_score}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

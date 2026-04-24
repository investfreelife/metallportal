import { createClient } from '@/lib/supabase/server'
import { formatMoney, timeAgo, getInitials, getActionTypeLabel } from '@/lib/utils'
import Link from 'next/link'
import DashboardQueue from './DashboardQueue'
import { FunnelWithDrawers } from '@/components/dashboard/FunnelWithDrawers'
import { TrafficChannels } from '@/components/dashboard/TrafficChannels'
import { DashboardRealtime } from '@/components/dashboard/DashboardRealtime'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

const STAGE_LABELS: Record<string, string> = {
  new: 'Новые', qualified: 'Квалификация',
  proposal: 'КП', negotiation: 'Переговоры', won: 'Закрыто ✓',
}
const STAGE_COLORS: Record<string, string> = {
  new: '#1a56db', qualified: '#EF9F27', proposal: '#8b5cf6',
  negotiation: '#E24B4A', won: '#639922',
}
const ACTIVITY_ICON_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  call:      { bg: 'bg-green-100',  text: 'text-green-700',  icon: '📞' },
  email:     { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: '✉' },
  ai_action: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '★' },
  message:   { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: '💬' },
  note:      { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: '📝' },
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const todayStr = new Date().toISOString().split('T')[0]

  const [
    { count: hotLeads },
    { count: pendingQueueCount },
    { data: dealsRaw },
    { data: queueItems },
    { data: hotContacts },
    { data: recentActivities },
    { count: unreadEmails },
    { data: insightRow },
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gt('ai_score', 60),
    supabase.from('ai_queue').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    supabase.from('deals').select('stage, amount').eq('tenant_id', TENANT_ID),
    supabase.from('ai_queue')
      .select('id, action_type, priority, ai_reasoning, content, created_at, contact:contacts(full_name, company_name)')
      .eq('tenant_id', TENANT_ID).eq('status', 'pending')
      .order('priority', { ascending: true }).limit(3),
    supabase.from('contacts').select('id, full_name, company_name, ai_score, ai_segment')
      .eq('tenant_id', TENANT_ID).gt('ai_score', 0).order('ai_score', { ascending: false }).limit(4),
    supabase.from('activities')
      .select('type, subject, body, created_at, contacts(full_name)')
      .eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(5),
    supabase.from('emails').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('is_read', false).eq('direction', 'inbound'),
    supabase.from('tenant_settings').select('value').eq('tenant_id', TENANT_ID).eq('key', `ai_insight_${todayStr}`).maybeSingle(),
  ])

  // Phase 2: дополнительные данные
  const [
    { data: contactSources },
    { data: lostDealsRaw },
    { data: wonDealsRaw },
    { count: hotLeadsWeekAgo },
  ] = await Promise.all([
    supabase.from('contacts').select('source').eq('tenant_id', TENANT_ID),
    supabase.from('deals').select('lost_reason, amount').eq('tenant_id', TENANT_ID).eq('stage', 'lost'),
    supabase.from('deals').select('amount').eq('tenant_id', TENANT_ID).eq('stage', 'won')
      .gte('closed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gt('ai_score', 60)
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const sourceMap: Record<string, number> = {}
  contactSources?.forEach((c: { source: string | null }) => { const s = c.source || 'Прямые'; sourceMap[s] = (sourceMap[s] || 0) + 1 })
  const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 8)

  const reasonMap: Record<string, number> = {}
  lostDealsRaw?.forEach((d: { lost_reason: string | null }) => { const r = d.lost_reason || 'Не указана'; reasonMap[r] = (reasonMap[r] || 0) + 1 })
  const lostReasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)

  const wonAmount = wonDealsRaw?.reduce((s: number, d: { amount: number | null }) => s + (d.amount || 0), 0) ?? 0
  const hotDelta = (hotLeads ?? 0) - (hotLeadsWeekAgo ?? 0)
  const avgDealDays = 14

  const allDeals = dealsRaw ?? []
  const pipelineTotal = allDeals.filter((d: { stage: string }) => !['won','lost'].includes(d.stage)).reduce((s: number, d: { amount: number }) => s + (d.amount ?? 0), 0)
  const wonTotal = allDeals.filter((d: { stage: string }) => d.stage === 'won').reduce((s: number, d: { amount: number }) => s + (d.amount ?? 0), 0)

  const stageGroups = ['new','qualified','proposal','negotiation','won'].map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    color: STAGE_COLORS[stage],
    count: allDeals.filter((d: { stage: string }) => d.stage === stage).length,
    amount: allDeals.filter((d: { stage: string }) => d.stage === stage).reduce((s: number, d: { amount: number }) => s + (d.amount ?? 0), 0),
  }))

  const insight = (insightRow as { value?: string } | null)?.value ?? null

  const todayDate = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const funnelSteps = [
    { key: 'visitors', label: 'Посетители', value: 1240, color: '#4A90D9' },
    { key: 'leads', label: 'Лиды', value: hotLeads ?? 0, color: '#2EAF82' },
    { key: 'proposals', label: 'КП', value: stageGroups.find(s => s.stage === 'proposal')?.count ?? 0, color: '#EF9F27' },
    { key: 'negotiations', label: 'Переговоры', value: stageGroups.find(s => s.stage === 'negotiation')?.count ?? 0, color: '#E24B4A' },
    { key: 'won', label: 'Закрыто', value: stageGroups.find(s => s.stage === 'won')?.count ?? 0, color: '#639922' },
  ]

  return (
    <div className="bg-gray-50">
      <style>{`
        .metric-card:hover { border-color: var(--card-color) !important; }
      `}</style>
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <h1 className="text-[15px] font-medium text-gray-900 flex-1">Дашборд</h1>
        <span className="text-xs text-gray-400 capitalize">{todayDate}</span>
        {(pendingQueueCount ?? 0) > 0 && (
          <Link href="/queue">
            <span className="bg-red-50 text-red-700 text-xs px-2.5 py-1 rounded-md font-medium border border-red-100">
              {pendingQueueCount} задач ИИ ждут
            </span>
          </Link>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* 4 метрики */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Горячих лидов', value: hotLeads ?? 0, delta: hotDelta > 0 ? `+${hotDelta} за неделю` : hotDelta < 0 ? `${hotDelta} за неделю` : '→ контакты', href: '/contacts', color: '#E24B4A' },
            { label: 'Pipeline', value: formatMoney(pipelineTotal), delta: `закрыто ${formatMoney(wonTotal)} ₽`, href: '/deals', color: '#1a56db' },
            { label: 'Задач ИИ', value: pendingQueueCount ?? 0, delta: 'ждут одобрения', href: '/queue', color: '#EF9F27' },
            { label: 'Новых писем', value: unreadEmails ?? 0, delta: 'непрочитанных', href: '/emails', color: '#27A882' },
          ].map(m => (
            <Link key={m.label} href={m.href}>
              <div
                className="metric-card bg-white border border-gray-200 rounded-xl cursor-pointer hover:shadow-sm transition-all"
                style={{ padding: '12px', borderLeft: `3px solid ${m.color}`, ['--card-color' as any]: m.color }}
              >
                <div className="text-[11px] text-gray-500 mb-1">{m.label}</div>
                <div className="text-[28px] font-medium text-gray-900 leading-tight">{m.value}</div>
                <div className="text-[11px] mt-0.5" style={{ color: m.color }}>{m.delta}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ИИ-инсайт */}
        {insight ? (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
            <div className="text-[11px] font-medium text-purple-600 mb-1">★ ИИ-инсайт дня</div>
            <div className="text-xs text-purple-900 leading-relaxed">
              {insight}
              <Link href="/queue" className="text-purple-600 underline ml-1 text-xs">Действовать ↗</Link>
            </div>
          </div>
        ) : (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2">
            <span className="text-[11px] font-medium text-purple-600">★ ИИ-инсайт дня</span>
            <Link href="/api/ai/daily-insight" className="text-[10px] text-purple-600 underline">Сгенерировать ↗</Link>
          </div>
        )}

        {/* Основная строка: Очередь ИИ + правая колонка */}
        <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
          {/* Очередь ИИ */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700">Очередь ИИ</span>
              <Link href="/queue" className="text-[11px] text-blue-600 hover:text-blue-700">все →</Link>
            </div>
            <DashboardQueue items={(queueItems ?? []).map((item: any) => ({ ...item, contact: Array.isArray(item.contact) ? item.contact[0] ?? null : item.contact }))} />
          </div>

          {/* Правая: воронка + каналы + активность */}
          <div className="flex flex-col gap-3">
            {/* Воронка — кликабельная */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Воронка продаж</span>
                <span className="text-[10px] text-gray-400">нажми на шаг</span>
              </div>
              <div className="p-3">
                <FunnelWithDrawers
                  steps={funnelSteps}
                  leadsBySource={leadsBySource}
                  lostReasons={lostReasons}
                  wonAmount={wonAmount}
                  avgDealDays={avgDealDays}
                />
              </div>
            </div>

            {/* Каналы трафика */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Каналы трафика</span>
                <span className="text-[10px] text-gray-400">нажми для анализа</span>
              </div>
              <div className="p-3">
                <TrafficChannels />
              </div>
            </div>

          </div>
        </div>

        {/* Нижняя строка: Pipeline + Горячие лиды + Активность */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Pipeline по стадиям */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-[12px] font-medium text-gray-700">Pipeline по стадиям</span>
              <Link href="/deals" className="text-[11px] text-blue-600 hover:text-blue-700">сделки →</Link>
            </div>
            <div className="p-3 grid grid-cols-5 gap-2">
              {stageGroups.map(s => (
                <div key={s.stage} className="text-center">
                  <div className="text-[10px] text-gray-400 mb-1 truncate">{s.label}</div>
                  <div className="text-base font-medium text-gray-900">{s.count}</div>
                  <div className="text-[10px] text-gray-500">{formatMoney(s.amount)}</div>
                  <div className="mt-1.5 h-[3px] rounded-full" style={{ backgroundColor: s.color, opacity: s.count > 0 ? 1 : 0.2 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Горячие лиды */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-[12px] font-medium text-gray-700">Горячие лиды</span>
              <Link href="/contacts" className="text-[11px] text-blue-600 hover:text-blue-700">все →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(hotContacts ?? []).length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">Нет горячих лидов</div>
              )}
              {(hotContacts ?? []).map((c: { id: string; full_name: string | null; company_name: string | null; ai_score: number; ai_segment: string | null }) => (
                <Link key={c.id} href={`/contacts/${c.id}`}>
                  <div className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 transition-colors">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                        c.ai_segment === 'hot' ? 'bg-red-50 text-red-700' :
                        c.ai_segment === 'warm' ? 'bg-amber-50 text-amber-700' :
                        c.ai_segment === 'cold' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {getInitials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{c.full_name || '—'}</div>
                      <div className="text-[11px] text-gray-500 truncate">{c.company_name || c.ai_segment || '—'}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-9 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.ai_score ?? 0}%`, background: (c.ai_score ?? 0) >= 70 ? '#E24B4A' : '#EF9F27' }} />
                      </div>
                      <span className="text-[11px] text-gray-500 w-5 text-right">{c.ai_score ?? 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Активность */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-[12px] font-medium text-gray-700">Активность</span>
            </div>
            <div className="divide-y divide-gray-50">
              {(recentActivities ?? []).length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">Нет активностей</div>
              )}
              {(recentActivities ?? []).map((a: any, i: number) => {
                const style = ACTIVITY_ICON_STYLES[a.type] ?? { bg: 'bg-gray-100', text: 'text-gray-600', icon: '📋' }
                return (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${style.bg} ${style.text}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-700 truncate">
                        {(Array.isArray(a.contacts) ? a.contacts[0] : a.contacts)?.full_name ?? a.subject ?? a.type}
                      </div>
                      <div className="text-[10px] text-gray-400">{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <DashboardRealtime tenantId={TENANT_ID} />
    </div>
  )
}

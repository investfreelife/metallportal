import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
import Link from 'next/link'
import DashboardQueue from './DashboardQueue'
import { FunnelClient } from '@/components/dashboard/FunnelClient'
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
const ACTIVITY_ICONS: Record<string, string> = {
  call: '📞', email: '✉', message: '💬', note: '📝', ai_action: '★',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const todayStr = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: hotLeads },
    { count: hotLeadsLastWeek },
    { count: pendingQueueCount },
    { data: dealsRaw },
    { data: queueItems },
    { data: hotContacts },
    { data: recentActivities },
    { count: unreadEmails },
    { data: insightRow },
    { data: leadSources },
    { data: lostDeals },
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gt('ai_score', 60),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gt('ai_score', 60).lt('created_at', weekAgo),
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
    supabase.from('contacts').select('source').eq('tenant_id', TENANT_ID).not('source', 'is', null),
    supabase.from('deals').select('lost_reason').eq('tenant_id', TENANT_ID).eq('stage', 'lost').not('lost_reason', 'is', null),
  ])

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

  // Агрегация источников лидов
  const sourceMap: Record<string, number> = {}
  leadSources?.forEach((c: { source: string | null }) => {
    const s = c.source || 'Прямые'
    sourceMap[s] = (sourceMap[s] || 0) + 1
  })
  const leadsBySource = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // Агрегация причин проигрышей
  const reasonMap: Record<string, number> = {}
  lostDeals?.forEach((d: { lost_reason: string | null }) => {
    const r = d.lost_reason || 'Не указана'
    reasonMap[r] = (reasonMap[r] || 0) + 1
  })
  const lostReasons = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  // Дельта горячих лидов
  const hotLeadsNow = hotLeads ?? 0
  const hotDelta = hotLeadsNow - (hotLeadsLastWeek ?? 0)
  const hotDeltaLabel = hotDelta > 0 ? `+${hotDelta} за неделю` : hotDelta < 0 ? `${hotDelta} за неделю` : 'без изменений'
  const hotDeltaColor = hotDelta > 0 ? '#22c55e' : hotDelta < 0 ? '#ef4444' : '#9ca3af'

  const proposalCount = stageGroups.find(s => s.stage === 'proposal')?.count ?? 0
  const negotiationCount = stageGroups.find(s => s.stage === 'negotiation')?.count ?? 0
  const wonCount = stageGroups.find(s => s.stage === 'won')?.count ?? 0

  return (
    <div className="bg-gray-50">
      <DashboardRealtime tenantId={TENANT_ID} />

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
          <Link href="/contacts">
            <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-[11px] text-gray-500 mb-1">Горячих лидов</div>
              <div className="text-2xl font-medium text-gray-900">{hotLeadsNow}</div>
              <div className="text-[11px] mt-0.5" style={{ color: hotDeltaColor }}>{hotDeltaLabel}</div>
            </div>
          </Link>
          <Link href="/deals">
            <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-[11px] text-gray-500 mb-1">Pipeline</div>
              <div className="text-2xl font-medium text-gray-900">{formatCurrency(pipelineTotal)}</div>
              <div className="text-[11px] mt-0.5" style={{ color: '#1a56db' }}>закрыто {formatCurrency(wonTotal)} ₽</div>
            </div>
          </Link>
          <Link href="/queue">
            <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-[11px] text-gray-500 mb-1">Задач ИИ</div>
              <div className="text-2xl font-medium text-gray-900">{pendingQueueCount ?? 0}</div>
              <div className="text-[11px] mt-0.5" style={{ color: '#8b5cf6' }}>ждут одобрения</div>
            </div>
          </Link>
          <Link href="/emails">
            <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-[11px] text-gray-500 mb-1">Новых писем</div>
              <div className="text-2xl font-medium text-gray-900">{unreadEmails ?? 0}</div>
              <div className="text-[11px] mt-0.5" style={{ color: '#EF9F27' }}>непрочитанных</div>
            </div>
          </Link>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Очередь ИИ — 2/3 */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700">Очередь ИИ</span>
              <Link href="/queue" className="text-[11px] text-blue-600 hover:text-blue-700">все →</Link>
            </div>
            <DashboardQueue items={(queueItems ?? []).map((item: any) => ({ ...item, contact: Array.isArray(item.contact) ? item.contact[0] ?? null : item.contact }))} />
          </div>

          {/* Правая: воронка + активность */}
          <div className="flex flex-col gap-3">
            {/* Воронка */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700">Воронка продаж</span>
              </div>
              <FunnelClient
                visitors={1240}
                leads={hotLeadsNow}
                proposals={proposalCount}
                negotiations={negotiationCount}
                won={wonCount}
                leadsBySource={leadsBySource}
                lostReasons={lostReasons}
              />
            </div>

            {/* Активность */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700">Активность</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(recentActivities ?? []).length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-gray-400">Нет активностей</div>
                )}
                {(recentActivities ?? []).map((a: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0">
                      {ACTIVITY_ICONS[a.type] ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-700 truncate">
                        {(Array.isArray(a.contacts) ? a.contacts[0] : a.contacts)?.full_name ?? a.subject ?? a.type}
                      </div>
                      <div className="text-[10px] text-gray-400">{formatRelativeTime(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Нижняя строка: Pipeline + Горячие лиды */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Pipeline по стадиям */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700">Pipeline по стадиям</span>
              <Link href="/deals" className="text-[11px] text-blue-600 hover:text-blue-700">сделки →</Link>
            </div>
            <div className="p-3 grid grid-cols-5 gap-2">
              {stageGroups.map(s => (
                <div key={s.stage} className="text-center">
                  <div className="text-[10px] text-gray-400 mb-1 truncate">{s.label}</div>
                  <div className="text-base font-medium text-gray-900">{s.count}</div>
                  <div className="text-[10px] text-gray-500">{formatCurrency(s.amount)}</div>
                  <div className="mt-1.5 h-[3px] rounded-full" style={{ backgroundColor: s.color, opacity: s.count > 0 ? 1 : 0.2 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Горячие лиды */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700">Горячие лиды</span>
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
        </div>
      </div>
    </div>
  )
}

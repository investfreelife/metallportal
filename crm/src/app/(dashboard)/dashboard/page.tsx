import { createClient } from '@/lib/supabase/server'
import { formatMoney, timeAgo, getInitials, getActionTypeLabel } from '@/lib/utils'
import Link from 'next/link'
import DashboardQueue from './DashboardQueue'

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
  call: '📞', email: '✉', message: '💬', note: '📝', ai_action: '🤖',
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
    { label: 'Посетители', value: 1240, color: '#B5D4F4', textColor: '#0C447C' },
    { label: 'Лиды', value: hotLeads ?? 0, color: '#9FE1CB', textColor: '#085041' },
    { label: 'КП', value: stageGroups.find(s => s.stage === 'proposal')?.count ?? 0, color: '#FAC775', textColor: '#633806' },
    { label: 'Переговоры', value: stageGroups.find(s => s.stage === 'negotiation')?.count ?? 0, color: '#F5C4B3', textColor: '#712B13' },
    { label: 'Закрыто', value: stageGroups.find(s => s.stage === 'won')?.count ?? 0, color: '#97C459', textColor: '#27500A' },
  ]
  const funnelMax = funnelSteps[0].value || 1

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
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

      <div className="flex-1 p-4 space-y-4 min-w-0">
        {/* 4 метрики */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Горячих лидов', value: hotLeads ?? 0, delta: '→ контакты', href: '/contacts', color: '#E24B4A' },
            { label: 'Pipeline', value: formatMoney(pipelineTotal), delta: `закрыто ${formatMoney(wonTotal)} ₽`, href: '/deals', color: '#1a56db' },
            { label: 'Задач ИИ', value: pendingQueueCount ?? 0, delta: 'ждут одобрения', href: '/queue', color: '#8b5cf6' },
            { label: 'Новых писем', value: unreadEmails ?? 0, delta: 'непрочитанных', href: '/emails', color: '#EF9F27' },
          ].map(m => (
            <Link key={m.label} href={m.href}>
              <div className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="text-[11px] text-gray-500 mb-1">{m.label}</div>
                <div className="text-xl font-medium text-gray-900">{m.value}</div>
                <div className="text-[11px] mt-0.5" style={{ color: m.color }}>{m.delta}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ИИ-инсайт */}
        {insight ? (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
            <div className="text-[10px] font-medium text-purple-700 mb-1">★ ИИ-инсайт дня</div>
            <div className="text-xs text-purple-900 leading-relaxed">
              {insight}
              <Link href="/queue" className="text-purple-600 underline ml-1 text-xs">Действовать ↗</Link>
            </div>
          </div>
        ) : (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-2">
            <span className="text-[10px] font-medium text-purple-700">★ ИИ-инсайт дня</span>
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
              <div className="p-3 space-y-1.5">
                {funnelSteps.map(step => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="w-[72px] text-[11px] text-gray-500 text-right flex-shrink-0">{step.label}</div>
                    <div className="flex-1 h-4 rounded-sm overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
                      <div
                        className="h-full rounded-sm flex items-center px-1.5"
                        style={{
                          width: `${Math.max(4, Math.round((step.value / funnelMax) * 100))}%`,
                          backgroundColor: step.color,
                        }}
                      >
                        <span className="text-[10px] font-medium" style={{ color: step.textColor }}>
                          {step.value}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                      <div className="text-[10px] text-gray-400">{timeAgo(a.created_at)}</div>
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
                  <div className="text-[10px] text-gray-500">{formatMoney(s.amount)}</div>
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
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0"
                      style={{ backgroundColor: (c.ai_score ?? 0) >= 70 ? '#E24B4A' : '#EF9F27' }}
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

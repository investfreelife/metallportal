import { createClient } from '@/lib/supabase/server'
import { AnalyticsClient } from './AnalyticsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period = periodParam || '30'
  const daysAgo = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()

  const [
    { data: deals },
    { data: contacts },
    { data: activities },
    { data: siteEvents },
    { data: aiQueueItems },
  ] = await Promise.all([
    supabase.from('deals').select('*').eq('tenant_id', TENANT_ID).gte('created_at', daysAgo),
    supabase.from('contacts').select('id, created_at, source, ai_score, ai_segment').eq('tenant_id', TENANT_ID).gte('created_at', daysAgo),
    supabase.from('activities').select('type, created_at').eq('tenant_id', TENANT_ID).gte('created_at', daysAgo),
    supabase.from('site_events').select('event_type, utm_source, created_at, device').eq('tenant_id', TENANT_ID).gte('created_at', daysAgo),
    supabase.from('ai_queue').select('status, created_at, action_type').eq('tenant_id', TENANT_ID).gte('created_at', daysAgo),
  ])

  // Выручка по дням
  const revenueByDay: Record<string, number> = {}
  deals?.forEach(d => {
    if (d.stage === 'won' && d.closed_at) {
      const day = d.closed_at.split('T')[0]
      revenueByDay[day] = (revenueByDay[day] || 0) + (d.amount || 0)
    }
  })

  // Лиды по дням
  const leadsByDay: Record<string, number> = {}
  contacts?.forEach(c => {
    const day = c.created_at.split('T')[0]
    leadsByDay[day] = (leadsByDay[day] || 0) + 1
  })

  // Каналы трафика из utm_source
  const channelMap: Record<string, number> = {}
  siteEvents?.forEach(e => {
    const ch = e.utm_source || 'Прямые'
    channelMap[ch] = (channelMap[ch] || 0) + 1
  })
  const channels = Object.entries(channelMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Активность по часам (0-23)
  const hourlyActivity = Array(24).fill(0)
  activities?.forEach(a => {
    const hour = new Date(a.created_at).getHours()
    hourlyActivity[hour]++
  })

  // Причины проигрышей
  const lostMap: Record<string, number> = {}
  deals?.filter(d => d.stage === 'lost').forEach(d => {
    const r = d.lost_reason || 'Не указана'
    lostMap[r] = (lostMap[r] || 0) + 1
  })
  const lostReasons = Object.entries(lostMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  // Pipeline по стадиям
  const stageMap: Record<string, { count: number; amount: number }> = {}
  deals?.forEach(d => {
    if (!stageMap[d.stage]) stageMap[d.stage] = { count: 0, amount: 0 }
    stageMap[d.stage].count++
    stageMap[d.stage].amount += d.amount || 0
  })

  // Устройства
  const deviceMap: Record<string, number> = {}
  siteEvents?.forEach(e => {
    const dev = e.device || 'desktop'
    deviceMap[dev] = (deviceMap[dev] || 0) + 1
  })

  // Метрики
  const wonDeals = deals?.filter(d => d.stage === 'won') || []
  const totalRevenue = wonDeals.reduce((s, d) => s + (d.amount || 0), 0)
  const totalLeads = contacts?.length || 0
  const totalVisitors = siteEvents?.filter(e => e.event_type === 'page_view').length || 0
  const conversionRate = totalVisitors > 0 ? ((totalLeads / totalVisitors) * 100).toFixed(1) : '0'
  const avgDeal = wonDeals.length > 0 ? Math.round(totalRevenue / wonDeals.length) : 0
  const aiApproved = aiQueueItems?.filter(i => i.status === 'approved').length || 0
  const aiTotal = aiQueueItems?.length || 0
  const aiEfficiency = aiTotal > 0 ? Math.round((aiApproved / aiTotal) * 100) : 0

  return (
    <AnalyticsClient
      period={period}
      metrics={{ totalRevenue, totalLeads, totalVisitors, conversionRate, avgDeal, wonDeals: wonDeals.length, aiEfficiency }}
      revenueByDay={revenueByDay}
      leadsByDay={leadsByDay}
      channels={channels}
      hourlyActivity={hourlyActivity}
      lostReasons={lostReasons}
      stageMap={stageMap}
      deviceMap={deviceMap}
      recentDeals={(deals || []).slice(0, 10)}
    />
  )
}

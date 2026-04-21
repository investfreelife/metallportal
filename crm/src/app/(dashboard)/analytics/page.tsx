import { createClient } from '@/lib/supabase/server'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string | number; sub?: string; color?: 'blue' | 'green' | 'amber' | 'red' | 'purple'
}) {
  const colors = {
    blue:   'text-blue-400',
    green:  'text-emerald-400',
    amber:  'text-amber-400',
    red:    'text-red-400',
    purple: 'text-purple-400',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400 text-xs w-32 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 text-xs w-8 text-right">{count}</span>
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Parallel queries
  const [
    { count: totalContacts },
    { count: newThisWeek },
    { count: activeDeals },
    { count: pendingQueue },
    { count: totalEvents },
    { data: contactsBySource },
    { data: dealsByStage },
    { data: recentEvents },
    { data: topPages },
    { data: scoreDistrib },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gte('created_at', weekAgo),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).not('stage', 'in', '("won","lost")'),
    supabase.from('ai_queue').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    supabase.from('site_events').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gte('created_at', weekAgo),
    supabase.from('contacts').select('source').eq('tenant_id', TENANT_ID).not('source', 'is', null),
    supabase.from('deals').select('stage').eq('tenant_id', TENANT_ID),
    supabase.from('site_events').select('event_type, created_at').eq('tenant_id', TENANT_ID).gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(100),
    supabase.from('site_events').select('url').eq('event_type', 'page_view').eq('tenant_id', TENANT_ID).gte('created_at', weekAgo),
    supabase.from('contacts').select('ai_score').eq('tenant_id', TENANT_ID).not('ai_score', 'is', null),
  ])

  // Process sources
  const sourceCounts: Record<string, number> = {}
  for (const c of (contactsBySource ?? [])) {
    const s = (c as { source: string }).source || 'прямой'
    sourceCounts[s] = (sourceCounts[s] || 0) + 1
  }
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxSource = topSources[0]?.[1] ?? 1

  // Process deal stages
  const stageCounts: Record<string, number> = {}
  const stageLabels: Record<string, string> = {
    new: 'Новые', qualified: 'Квалиф.', proposal: 'КП', negotiation: 'Переговоры', won: 'Выиграны', lost: 'Проиграны',
  }
  for (const d of (dealsByStage ?? [])) {
    const s = (d as { stage: string }).stage
    stageCounts[s] = (stageCounts[s] || 0) + 1
  }

  // Process event types
  const eventTypeCounts: Record<string, number> = {}
  for (const e of (recentEvents ?? [])) {
    const t = (e as { event_type: string }).event_type
    eventTypeCounts[t] = (eventTypeCounts[t] || 0) + 1
  }
  const topEventTypes = Object.entries(eventTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Top pages
  const pageCounts: Record<string, number> = {}
  for (const e of (topPages ?? [])) {
    const u = (e as { url: string }).url || '/'
    pageCounts[u] = (pageCounts[u] || 0) + 1
  }
  const topPagesList = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxPage = topPagesList[0]?.[1] ?? 1

  // Score distribution
  let highScore = 0, medScore = 0, lowScore = 0
  for (const c of (scoreDistrib ?? [])) {
    const s = (c as { ai_score: number }).ai_score
    if (s >= 60) highScore++
    else if (s >= 30) medScore++
    else lowScore++
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Аналитика</h1>
        <p className="text-gray-500 text-sm mt-0.5">Данные за последние 7 дней</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Всего контактов" value={totalContacts ?? 0} color="blue" />
        <StatCard label="Новых за неделю" value={newThisWeek ?? 0} color="green" />
        <StatCard label="Активных сделок" value={activeDeals ?? 0} color="purple" />
        <StatCard label="Событий на сайте" value={totalEvents ?? 0} sub="за 7 дней" color="amber" />
        <StatCard label="Ожидают в Queue" value={pendingQueue ?? 0} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sources */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Источники контактов</h2>
          {topSources.length === 0
            ? <p className="text-gray-600 text-sm">Нет данных</p>
            : <div className="space-y-3">
                {topSources.map(([s, c]) => (
                  <BarRow key={s} label={s} count={c} max={maxSource} color="bg-blue-500" />
                ))}
              </div>
          }
        </div>

        {/* Deal pipeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Воронка сделок</h2>
          {Object.keys(stageCounts).length === 0
            ? <p className="text-gray-600 text-sm">Нет сделок</p>
            : <div className="space-y-2">
                {Object.entries(stageCounts).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                    <span className="text-gray-300 text-sm">{stageLabels[stage] ?? stage}</span>
                    <span className="text-white font-semibold">{count}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Top pages */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Популярные страницы</h2>
          {topPagesList.length === 0
            ? <p className="text-gray-600 text-sm">Нет данных (трекер подключён?)</p>
            : <div className="space-y-3">
                {topPagesList.map(([url, count]) => (
                  <BarRow key={url} label={url} count={count} max={maxPage} color="bg-emerald-500" />
                ))}
              </div>
          }
        </div>

        {/* Event types */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">События за неделю</h2>
          {topEventTypes.length === 0
            ? <p className="text-gray-600 text-sm">Нет данных</p>
            : <div className="space-y-2">
                {topEventTypes.map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                    <span className="text-gray-400 text-sm font-mono">{type}</span>
                    <span className="text-white font-semibold">{count}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* AI Score distribution */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Распределение AI Score</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-emerald-500/10 rounded-lg p-4">
            <p className="text-3xl font-bold text-emerald-400">{highScore}</p>
            <p className="text-gray-500 text-xs mt-1">Горячие (60–100)</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-4">
            <p className="text-3xl font-bold text-amber-400">{medScore}</p>
            <p className="text-gray-500 text-xs mt-1">Тёплые (30–59)</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-3xl font-bold text-gray-400">{lowScore}</p>
            <p className="text-gray-500 text-xs mt-1">Холодные (0–29)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'

/**
 * /dream/analytics — Воронка, конверсии, разбивка по нишам и городам.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Аналитика · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const FUNNEL = [
  { key: 'new',       label: '🆕 Новые',         color: '#6366f1' },
  { key: 'enriched',  label: '🛰 Спарсены',      color: '#0ea5e9' },
  { key: 'generated', label: '🎨 Лендинг готов', color: '#06b6d4' },
  { key: 'outreach',  label: '📨 Outreach',      color: '#f59e0b' },
  { key: 'contacted', label: '📞 Связались',     color: '#ea580c' },
  { key: 'hot',       label: '🔥 Горячие',       color: '#dc2626' },
  { key: 'proposal',  label: '📋 КП',            color: '#7c3aed' },
  { key: 'won',       label: '✅ Купили',        color: '#16a34a' },
]

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: leads } = await supabase
    .from('dream_leads')
    .select('id, niche, city, status, rating, reviews_count, price, completeness_score, created_at, contacted_at, sold_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .limit(2000)

  return leads ?? []
}

export default async function AnalyticsPage() {
  const leads = await loadData()
  const total = leads.length

  const byStatus: Record<string, number> = {}
  for (const l of leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1

  // Conversion rates relative to "new"
  const baseline = byStatus.new ?? 0
  const conv = (cnt: number) => baseline > 0 ? ((cnt / baseline) * 100).toFixed(1) + '%' : '—'

  // Niches breakdown
  const nicheMap: Record<string, { count: number; ratingSum: number; ratingN: number; won: number; revenue: number }> = {}
  for (const l of leads) {
    const k = l.niche ?? '—'
    if (!nicheMap[k]) nicheMap[k] = { count: 0, ratingSum: 0, ratingN: 0, won: 0, revenue: 0 }
    nicheMap[k].count++
    if (l.rating) { nicheMap[k].ratingSum += l.rating; nicheMap[k].ratingN++ }
    if (l.status === 'won') {
      nicheMap[k].won++
      nicheMap[k].revenue += l.price ?? 25000
    }
  }
  const niches = Object.entries(nicheMap)
    .map(([niche, v]) => ({
      niche,
      ...v,
      avgRating: v.ratingN > 0 ? v.ratingSum / v.ratingN : null,
      conversionRate: v.count > 0 ? (v.won / v.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Lead time: avg days from new → contacted, contacted → won
  const newToContacted = leads
    .filter((l) => l.contacted_at && l.created_at)
    .map((l) => (new Date(l.contacted_at!).getTime() - new Date(l.created_at).getTime()) / 86400000)
  const contactedToWon = leads
    .filter((l) => l.sold_at && l.contacted_at)
    .map((l) => (new Date(l.sold_at!).getTime() - new Date(l.contacted_at!).getTime()) / 86400000)

  const avg = (arr: number[]) => arr.length ? (arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(1) : '—'

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">📊 Аналитика</h1>
          <p className="text-white/80 text-sm mt-1">
            Конверсия по этапам · разбивка по нишам · скорость прохождения воронки
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Top metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Всего лидов" value={String(total)} sub="за всё время" accent="#0ea5e9" />
          <Metric label="Куплено" value={String(byStatus.won ?? 0)} sub={`конверсия ${total > 0 ? (((byStatus.won ?? 0) / total) * 100).toFixed(1) : 0}%`} accent="#16a34a" />
          <Metric label="Новый → Связались" value={`${avg(newToContacted)} дн`} sub="в среднем" accent="#f59e0b" />
          <Metric label="Связались → Куплено" value={`${avg(contactedToWon)} дн`} sub="в среднем" accent="#7c3aed" />
        </div>

        {/* Funnel */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Воронка</h2>
          <div className="space-y-2.5">
            {FUNNEL.map((s) => {
              const cnt = byStatus[s.key] ?? 0
              const widthPct = baseline > 0 ? Math.min(100, (cnt / baseline) * 100) : 0
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between text-[12px] mb-1">
                    <span className="font-medium text-gray-700">{s.label}</span>
                    <span className="text-gray-500">
                      <b className="text-gray-900">{cnt}</b> · конверсия от Новые: {conv(cnt)}
                    </span>
                  </div>
                  <div className="h-7 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md flex items-center px-2 text-[11px] font-medium text-white"
                      style={{ background: s.color, width: `${widthPct}%` }}
                    >
                      {widthPct >= 8 && cnt > 0 && cnt}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Niches table */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Ниши</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Где конверсия лучше — туда фокус парсинга</p>
          </div>
          {niches.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-gray-400 italic">данных пока недостаточно</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Ниша</th>
                  <th className="px-4 py-2 text-right font-medium">Лидов</th>
                  <th className="px-4 py-2 text-right font-medium">Средний ⭐</th>
                  <th className="px-4 py-2 text-right font-medium">Куплено</th>
                  <th className="px-4 py-2 text-right font-medium">Конверсия</th>
                  <th className="px-4 py-2 text-right font-medium">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {niches.map((n) => (
                  <tr key={n.niche} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{n.niche}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{n.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">
                      {n.avgRating ? `${n.avgRating.toFixed(1)} ⭐` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{n.won}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        n.conversionRate >= 10 ? 'bg-emerald-100 text-emerald-700'
                        : n.conversionRate >= 5 ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {n.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {n.revenue > 0 ? `${(n.revenue / 1000).toFixed(0)}K ₽` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="text-[28px] font-bold leading-none text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1.5">{sub}</div>
    </div>
  )
}

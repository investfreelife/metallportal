import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

/**
 * /dream/finance — выручка, прогноз воронки, средний чек, история сделок.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Финансы · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: leads } = await supabase
    .from('dream_leads')
    .select('id, slug, name, niche, status, price, sold_at, contacted_at, created_at, updated_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .limit(2000)

  return leads ?? []
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн ₽'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K ₽'
  return n.toLocaleString('ru-RU') + ' ₽'
}

export default async function FinancePage() {
  const leads = await loadData()

  const won = leads.filter((l) => l.status === 'won')
  const pipeline = leads.filter((l) => ['outreach', 'contacted', 'hot', 'proposal'].includes(l.status))
  const lost = leads.filter((l) => l.status === 'lost')

  const wonRevenue = won.reduce((s, l) => s + (l.price ?? 25000), 0)
  const pipelineForecast = pipeline.reduce((s, l) => s + (l.price ?? 25000), 0)

  const avgCheck = won.length > 0 ? Math.round(wonRevenue / won.length) : 25000

  // Revenue по месяцам (sold_at)
  const monthMap: Record<string, { revenue: number; count: number }> = {}
  for (const l of won) {
    if (!l.sold_at) continue
    const ym = l.sold_at.slice(0, 7) // YYYY-MM
    if (!monthMap[ym]) monthMap[ym] = { revenue: 0, count: 0 }
    monthMap[ym].revenue += l.price ?? 25000
    monthMap[ym].count++
  }
  const months = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)

  // Target tracking — цель 100K ₽/нед
  const targetWeekly = 100_000
  const targetMonthly = targetWeekly * 4
  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonth = monthMap[currentMonth] ?? { revenue: 0, count: 0 }
  const monthProgressPct = Math.min(100, Math.round((thisMonth.revenue / targetMonthly) * 100))

  // Last 5 wins
  const recentWins = won
    .filter((l) => l.sold_at)
    .sort((a, b) => (b.sold_at ?? '').localeCompare(a.sold_at ?? ''))
    .slice(0, 5)

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">💰 Финансы</h1>
          <p className="text-white/80 text-sm mt-1">
            Цель: 100 000 ₽/неделю. Текущий месяц: {fmtMoney(thisMonth.revenue)} из {fmtMoney(targetMonthly)} ({monthProgressPct}%)
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Top metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Выручка всего" value={fmtMoney(wonRevenue)} sub={`${won.length} сделок`} accent="#16a34a" />
          <Metric label="Этот месяц" value={fmtMoney(thisMonth.revenue)} sub={`${thisMonth.count} сделок · ${monthProgressPct}% цели`} accent="#10b981" />
          <Metric label="Средний чек" value={fmtMoney(avgCheck)} sub={won.length > 0 ? 'по фактическим' : 'базовая цена'} accent="#0d9488" />
          <Metric label="Прогноз воронки" value={fmtMoney(pipelineForecast)} sub={`${pipeline.length} в работе`} accent="#7c3aed" />
        </div>

        {/* Target progress bar */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Цель месяца — {fmtMoney(targetMonthly)}</h2>
            <span className="text-[12px] text-gray-500">{fmtMoney(thisMonth.revenue)} / {fmtMoney(targetMonthly)}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
              style={{ width: `${monthProgressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
            Чтобы добить цель этого месяца — нужно ещё <b>{Math.max(0, Math.ceil((targetMonthly - thisMonth.revenue) / avgCheck))}</b> сделок (по среднему чеку {fmtMoney(avgCheck)}).
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue by month */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Выручка по месяцам</h2>
            </div>
            {months.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-gray-400 italic">пока ничего не куплено</div>
            ) : (
              <div className="p-5 space-y-2">
                {(() => {
                  const max = Math.max(...months.map(([, v]) => v.revenue), targetMonthly)
                  return months.map(([ym, v]) => {
                    const pct = Math.round((v.revenue / max) * 100)
                    return (
                      <div key={ym}>
                        <div className="flex items-baseline justify-between text-[11px] mb-1">
                          <span className="font-mono text-gray-600">{ym}</span>
                          <span><b>{v.count}</b> · {fmtMoney(v.revenue)}</span>
                        </div>
                        <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-md"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </section>

          {/* Last wins */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Последние победы</h2>
            </div>
            {recentWins.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-gray-400 italic">пока пусто</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentWins.map((l) => (
                  <li key={l.id}>
                    <Link href={`/dream/leads/${l.slug}`} className="block px-5 py-3 hover:bg-gray-50">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="font-medium text-[13px] text-gray-900 truncate">{l.name}</span>
                        <span className="text-[13px] font-bold text-emerald-600 flex-shrink-0">{fmtMoney(l.price ?? 25000)}</span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {l.niche ?? '—'} · продано {l.sold_at?.slice(0, 10)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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

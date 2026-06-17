import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { ParserTabs } from './ParserTabs'

/**
 * /dream/parser — РЕДИЗАЙН по Sergey directive 2026-06-17:
 * «снеси все, заведи 3 вкладки:
 *   1. Всего спарсено
 *   2. Без сайта
 *   3. Полный парсинг — можно нажать и увидеть всю информацию»
 *
 * Источник правды: SPEC `~/Documents/Claude/Projects/Мечта/app/queue/SPEC/PARSING_PIPELINE_SPEC.md`
 *   ЭТАП 1 Discovery → dream_businesses (713 на 17.06)
 *   ЭТАП 2 Filter   → dream_businesses WHERE has_website=0 (277)
 *   ЭТАП 3-5 Enrich → dream_leads (1 = Avtoclean)
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Парсер · Мечта' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

async function loadCounts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [
    { count: total },
    { count: noSite },
    { count: enriched },
    { data: runs },
    { data: nichesAgg },
  ] = await Promise.all([
    supabase.from('dream_businesses').select('id', { count: 'exact', head: true })
      .eq('tenant_id', DREAM_TENANT_ID),
    supabase.from('dream_businesses').select('id', { count: 'exact', head: true })
      .eq('tenant_id', DREAM_TENANT_ID).eq('has_website', 0),
    supabase.from('dream_businesses').select('id', { count: 'exact', head: true })
      .eq('tenant_id', DREAM_TENANT_ID).not('enriched_at', 'is', null),
    supabase.from('dream_discovery_runs').select('*')
      .order('started_at', { ascending: false }).limit(10),
    supabase.from('dream_businesses').select('niche, city')
      .eq('tenant_id', DREAM_TENANT_ID),
  ])

  // Группировка по нишам и городам
  const nichesMap: Record<string, number> = {}
  const citiesMap: Record<string, number> = {}
  for (const b of (nichesAgg ?? [])) {
    if (b.niche) nichesMap[b.niche] = (nichesMap[b.niche] ?? 0) + 1
    if (b.city) citiesMap[b.city] = (citiesMap[b.city] ?? 0) + 1
  }

  return {
    total: total ?? 0,
    noSite: noSite ?? 0,
    enriched: enriched ?? 0,
    runs: runs ?? [],
    niches: Object.entries(nichesMap).sort((a, b) => b[1] - a[1]),
    cities: Object.entries(citiesMap).sort((a, b) => b[1] - a[1]),
  }
}

function fmtAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

export default async function ParserPage() {
  const { total, noSite, enriched, runs, niches, cities } = await loadCounts()
  const lastRun = runs[0]

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-500 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🛰 Парсер</h1>
            <p className="text-white/80 text-sm mt-1">
              Discovery (OSM + Bright Data) → Filter (без сайта) → Enrichment (полная карточка)
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/70">Последний запуск</div>
            <div className="text-sm font-medium">{lastRun ? fmtAgo(lastRun.started_at) : 'нет данных'}</div>
            {lastRun && (
              <div className="text-[11px] text-white/70 mt-0.5">{lastRun.source} · {lastRun.status}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Top metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Всего спарсено" value={String(total)} sub={`в ${cities.length} городах`} accent="#0ea5e9" />
          <Metric label="Без сайта" value={String(noSite)} sub={`${Math.round((noSite / Math.max(total, 1)) * 100)}% от всего`} accent="#f59e0b" />
          <Metric label="Полная карточка" value={String(enriched)} sub="ЭТАП 3 Bright Data" accent="#10b981" />
          <Metric label="Discovery runs" value={String(runs.length)} sub="последние" accent="#7c3aed" />
        </div>

        {/* TABS — главный экран */}
        <ParserTabs total={total} noSite={noSite} enriched={enriched} />

        {/* Runs timeline */}
        {runs.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Запуски парсера</h2>
            </div>
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Когда</th>
                  <th className="px-4 py-2 text-left font-medium">Источник</th>
                  <th className="px-4 py-2 text-left font-medium">Ниша</th>
                  <th className="px-4 py-2 text-right font-medium">Найдено</th>
                  <th className="px-4 py-2 text-right font-medium">Импорт</th>
                  <th className="px-4 py-2 text-left font-medium">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runs.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{fmtAgo(r.started_at)}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-[11px]">{r.source}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.niche ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.found}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.imported}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        r.status === 'success' ? 'bg-emerald-100 text-emerald-700'
                        : r.status === 'failed' ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Niches + Cities breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownCard title="Ниши" items={niches.slice(0, 10)} accent="#0ea5e9" />
          <BreakdownCard title="Города" items={cities.slice(0, 10)} accent="#7c3aed" />
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

function BreakdownCard({ title, items, accent }: { title: string; items: [string, number][]; accent: string }) {
  const max = Math.max(...items.map(([, n]) => n), 1)
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-4 space-y-2">
        {items.length === 0 ? (
          <div className="text-[12px] text-gray-400 italic">—</div>
        ) : items.map(([name, cnt]) => {
          const pct = (cnt / max) * 100
          return (
            <div key={name}>
              <div className="flex items-baseline justify-between text-[12px] mb-1">
                <span className="text-gray-700 truncate flex-1">{name}</span>
                <span className="tabular-nums font-medium text-gray-900">{cnt}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

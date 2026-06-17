import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

/**
 * /dream — Главная проекта «Мечта — Лендинг-фабрика».
 *
 * Sergey directive: «производство лендингов из карт яндекса, мировой уровень,
 * сам изучи проект, делай дашборд и все остальное. Лиды будут приходить из
 * парсера на данном этапе».
 *
 * Server component: fetches dream_leads aggregate + topN, рисует hero-dashboard.
 * Карточка одного лида — `/dream/leads/[slug]`.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Мечта — Лендинг-фабрика · CRM' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  new:       { label: 'Новые',         color: '#6366f1', emoji: '🆕' },
  enriched:  { label: 'Спарсены',      color: '#0ea5e9', emoji: '🛰' },
  generated: { label: 'Лендинг готов', color: '#06b6d4', emoji: '🎨' },
  outreach:  { label: 'Outreach',      color: '#f59e0b', emoji: '📨' },
  contacted: { label: 'Связались',     color: '#ea580c', emoji: '📞' },
  hot:       { label: 'Горячие',       color: '#dc2626', emoji: '🔥' },
  proposal:  { label: 'КП',            color: '#7c3aed', emoji: '📋' },
  won:       { label: 'Купили',        color: '#16a34a', emoji: '✅' },
  lost:      { label: 'Отказ',         color: '#71717a', emoji: '❌' },
  wont_do:   { label: 'Не делаем',     color: '#a3a3a3', emoji: '⏸' },
}

const FUNNEL = ['enriched', 'generated', 'outreach', 'contacted', 'hot', 'proposal', 'won']

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [
    { data: leads },
    { data: parserRuns },
    { data: recentActivities },
  ] = await Promise.all([
    supabase
      .from('dream_leads')
      .select('id, slug, name, niche, city, address, phone_display, rating, reviews_count, services_count, photos_count, status, price, completeness_score, updated_at, sold_at, contacted_at')
      .eq('tenant_id', DREAM_TENANT_ID)
      .order('updated_at', { ascending: false }),
    supabase
      .from('dream_parser_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('dream_activities')
      .select('id, lead_id, type, direction, channel, body, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    leads: leads ?? [],
    parserRuns: parserRuns ?? [],
    recentActivities: recentActivities ?? [],
  }
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн ₽'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K ₽'
  return n.toLocaleString('ru-RU') + ' ₽'
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад`
}

export default async function DreamHomePage() {
  const { leads, parserRuns, recentActivities } = await loadData()

  const byStatus: Record<string, number> = {}
  let pipelineSum = 0
  let wonSum = 0
  const niches: Record<string, { count: number; ratingSum: number; ratingN: number }> = {}
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
    if (['outreach', 'contacted', 'hot', 'proposal'].includes(l.status)) {
      pipelineSum += l.price ?? 25000
    }
    if (l.status === 'won') wonSum += l.price ?? 25000
    if (l.niche) {
      const n = niches[l.niche] ?? { count: 0, ratingSum: 0, ratingN: 0 }
      n.count++
      if (l.rating) { n.ratingSum += l.rating; n.ratingN++ }
      niches[l.niche] = n
    }
  }

  const total = leads.length
  const avgRating = leads.filter(l => l.rating).reduce((s, l) => s + (l.rating ?? 0), 0) / Math.max(1, leads.filter(l => l.rating).length)

  // Top leads: priority by completeness * rating
  const topLeads = [...leads]
    .filter(l => !['won', 'lost', 'wont_do'].includes(l.status))
    .sort((a, b) => ((b.rating ?? 0) * (b.completeness_score ?? 0.5)) - ((a.rating ?? 0) * (a.completeness_score ?? 0.5)))
    .slice(0, 6)

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">🎯 Мечта — Лендинг-фабрика</h1>
              <p className="text-white/80 text-sm mt-1">
                Парсим бизнес Москвы из Яндекс.Карт → генерируем готовые HTML сайты → продаём за 25 000 ₽ под ключ
              </p>
            </div>
            <Link
              href="/dream/leads"
              className="bg-white text-purple-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90"
            >
              Все лиды →
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* 4 big metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Всего лидов" value={String(total)} sub={`средний ⭐ ${avgRating.toFixed(1)}`} accent="#6366f1" />
          <MetricCard label="В работе" value={String(
            (byStatus.outreach ?? 0) + (byStatus.contacted ?? 0) + (byStatus.hot ?? 0) + (byStatus.proposal ?? 0)
          )} sub={`${byStatus.new ?? 0} ждут outreach`} accent="#f59e0b" />
          <MetricCard label="Прогноз воронки" value={fmtMoney(pipelineSum)} sub="при текущем pipeline" accent="#7c3aed" />
          <MetricCard label="Закрыто" value={fmtMoney(wonSum)} sub={`${byStatus.won ?? 0} сделок`} accent="#16a34a" />
        </div>

        {/* 2 columns: funnel + top leads */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Воронка</h2>
            <div className="space-y-2.5">
              {FUNNEL.map((s) => {
                const count = byStatus[s] ?? 0
                const maxN = Math.max(...FUNNEL.map(x => byStatus[x] ?? 0), 1)
                const pct = Math.round((count / maxN) * 100)
                const meta = STATUS_META[s]
                return (
                  <div key={s}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{meta.emoji} {meta.label}</span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                    <div className="bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {(byStatus.lost ?? 0) + (byStatus.wont_do ?? 0) > 0 && (
              <div className="mt-4 text-xs text-gray-500">
                Lost: {byStatus.lost ?? 0} · Не делаем: {byStatus.wont_do ?? 0}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">🎯 Топ-лиды (приоритет)</h2>
            {topLeads.length === 0 ? (
              <div className="text-sm text-gray-500 italic">
                Лидов пока нет.{' '}
                <Link href="/dream/parser" className="text-blue-600 hover:underline">Запусти парсер</Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {topLeads.map((l) => {
                  const meta = STATUS_META[l.status]
                  return (
                    <li key={l.id}>
                      <Link href={`/dream/leads/${l.slug}`} className="block hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-semibold text-gray-900 truncate">{l.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: meta.color + '22', color: meta.color }}>
                            {meta.emoji} {meta.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          ⭐ {l.rating ?? '—'} · {l.reviews_count ?? 0} отз · {l.niche ?? '—'}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Niches breakdown */}
        {Object.keys(niches).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ниши</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(niches).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([n, info]) => (
                <div key={n} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wider text-gray-500 truncate" title={n}>{n}</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{info.count}</div>
                  <div className="text-xs text-gray-500">
                    ⭐ {info.ratingN ? (info.ratingSum / info.ratingN).toFixed(1) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parser runs + recent activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">🛰 Парсер — последние прогоны</h2>
            {parserRuns.length === 0 ? (
              <div className="text-sm text-gray-500 italic">
                Парсер не пушил в CRM. Парсер живёт в{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">~/Documents/Claude/Projects/Мечта/</code>
                <div className="mt-2 text-xs">
                  Эндпоинт для импорта:{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">POST /api/dream/leads/import</code>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {parserRuns.map((r: any) => (
                  <li key={r.id} className="border border-gray-100 rounded p-3 text-sm">
                    <div className="font-medium">{r.source} · {r.mode}</div>
                    <div className="text-xs text-gray-500">
                      {r.leads_imported}/{r.leads_found} лидов · ${r.cost_usd ?? 0} · {timeAgo(r.started_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">📜 Последние действия</h2>
            {recentActivities.length === 0 ? (
              <div className="text-sm text-gray-500 italic">Пока тихо — outreach начнётся когда статусы дойдут до «generated».</div>
            ) : (
              <ul className="space-y-2">
                {recentActivities.map((a: any) => (
                  <li key={a.id} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{a.type}</span>
                      <span className="text-xs text-gray-400">{timeAgo(a.created_at)}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{a.body ?? ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-3xl font-bold text-gray-900 mt-2 leading-none">{value}</div>
      <div className="text-xs text-gray-500 mt-2">{sub}</div>
    </div>
  )
}

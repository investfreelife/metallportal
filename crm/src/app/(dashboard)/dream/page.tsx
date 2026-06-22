/**
 * /dream — Главная проекта «Мечта — Лендинг-фабрика».
 *
 * TASK_027 (SEV-1): исключить мусор из ВСЕХ цифр и переделать воронку
 * под реальные этапы звонков (Лендинг/Звонили/Не дозвонились/Дозвонились/
 * Мёртвые/Ссылка отправлена/Горячие/КП/Купили).
 *
 * Источник истины:
 *   - Чистый лид = build_status != 'trash' И trash_reason IS NULL
 *     И tags НЕ пересекает {do-not-publish, closed, has-site, trash}.
 *   - Звонок = запись в dream_calls (lead_id) ИЛИ count_attempts > 0.
 *   - Этап = sales_stage (актуальный) + наличие записей в dream_calls.
 */
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { nicheMeta } from '@/lib/dream/niches'
import { SALES_STAGE_RU, salesStageCls } from '@/lib/dream/statuses'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Мечта — Лендинг-фабрика · CRM' }

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'
const AVG_DEAL = 25000

// Грубые вероятности конверсии по этапам (для прогноза ₽)
const STAGE_PROB: Record<string, number> = {
  site_ready: 0.05, to_call: 0.05, no_answer: 0.03, reached: 0.10,
  qualified: 0.20, link_sent: 0.30, negotiating: 0.55, callback: 0.25,
}

// Стоп-теги — лид НЕ показывается в активной воронке
const STOP_TAGS = new Set(['do-not-publish', 'closed', 'has-site', 'trash', 'wrong-niche'])

function isMusor(l: any): boolean {
  if (l.build_status === 'trash') return true
  if (l.trash_reason) return true
  if (Array.isArray(l.tags) && l.tags.some((t: string) => STOP_TAGS.has(t))) return true
  return false
}

async function loadData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [
    { data: leads },
    { data: callsGroup },
    { data: parserRuns },
    { data: recentActivities },
  ] = await Promise.all([
    // TASK_027: тянем поля для фильтра мусора и расчёта этапов
    supabase
      .from('dream_leads')
      .select('id, slug, name, niche, city, address, phone_display, phone, rating, reviews_count, services_count, photos_count, status, build_status, sales_stage, qualification, tags, trash_reason, website_url, price, completeness_score, updated_at, sold_at, contacted_at, landing_public_url, landing_deployed_url, visits_count, total_time_on_site_sec, max_scroll_pct, call_attempts, next_action_at, last_contact_at, last_channel')
      .eq('tenant_id', DREAM_TENANT_ID)
      .order('updated_at', { ascending: false }),
    // Звонки группировкой по lead_id — для определения «звонили / не дозвонились / дозвонились»
    supabase
      .from('dream_calls')
      .select('lead_id, status, result')
      .eq('tenant_id', DREAM_TENANT_ID),
    supabase
      .from('dream_discovery_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5)
      .maybeSingle()
      .then(
        (r) => ({ data: Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []) }),
        () => ({ data: [] }),
      ),
    supabase
      .from('dream_activities')
      .select('id, lead_id, type, actor, title, body, ts, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    leads: leads ?? [],
    callsGroup: callsGroup ?? [],
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
  const { leads, callsGroup, parserRuns, recentActivities } = await loadData()

  // TASK_027 §1: разделить чистых и мусор
  const cleanLeads = leads.filter((l) => !isMusor(l))
  const musorCount = leads.length - cleanLeads.length

  // Карта звонков по lead_id
  const callsByLead = new Map<number, { total: number; reached: number; no_answer: number }>()
  callsGroup.forEach((c: any) => {
    if (!c.lead_id) return
    const v = callsByLead.get(c.lead_id) ?? { total: 0, reached: 0, no_answer: 0 }
    v.total++
    if (c.status === 'completed') v.reached++
    else if (c.status === 'no_answer' || c.status === 'failed' || c.status === 'busy') v.no_answer++
    callsByLead.set(c.lead_id, v)
  })

  // TASK_027 §2: воронка по реальным этапам
  const REACHED_STAGES = ['reached', 'qualified', 'link_sent', 'negotiating', 'callback']
  const HOT_STAGES = ['qualified', 'link_sent', 'negotiating']

  let nLanding = 0, nCalled = 0, nNoAnswer = 0, nReached = 0, nDead = 0
  let nLinkSent = 0, nHot = 0, nProposal = 0, nWon = 0, nLost = 0

  for (const l of cleanLeads) {
    const calls = callsByLead.get(l.id)
    const hasLanding = !!(l.landing_public_url || l.landing_deployed_url)
    const hasCalls = !!calls && calls.total > 0
    const isReached = REACHED_STAGES.includes(l.sales_stage) || (calls?.reached ?? 0) > 0

    if (hasLanding) nLanding++
    if (hasCalls) nCalled++
    if (l.sales_stage === 'no_answer' && (calls?.reached ?? 0) === 0) nNoAnswer++
    if (isReached) nReached++
    if (l.sales_stage === 'disqualified' || l.qualification === 'disqualified') nDead++
    if (l.sales_stage === 'link_sent') nLinkSent++
    if ((l.visits_count ?? 0) > 0) nHot++
    if (l.sales_stage === 'negotiating') nProposal++
    if (l.sales_stage === 'won') nWon++
    if (l.sales_stage === 'lost') nLost++
  }

  const FUNNEL = [
    { key: 'landing',    label: 'Лендинг готов',      emoji: '🧱', count: nLanding,  color: '#06b6d4' },
    { key: 'called',     label: 'Звонили',            emoji: '📞', count: nCalled,   color: '#0ea5e9' },
    { key: 'no_answer',  label: 'Не дозвонились',     emoji: '❌', count: nNoAnswer, color: '#71717a' },
    { key: 'reached',    label: 'Дозвонились',        emoji: '✅', count: nReached,  color: '#16a34a' },
    { key: 'link_sent',  label: 'Ссылка отправлена',  emoji: '🔗', count: nLinkSent, color: '#7c3aed' },
    { key: 'hot',        label: 'Горячие (зашёл)',    emoji: '🔥', count: nHot,      color: '#dc2626' },
    { key: 'proposal',   label: 'КП / переговоры',    emoji: '📋', count: nProposal, color: '#9333ea' },
    { key: 'won',        label: 'Купили',             emoji: '💰', count: nWon,      color: '#22c55e' },
  ]
  const maxN = Math.max(...FUNNEL.map((s) => s.count), 1)

  // Метрика «В работе» — чистые в активных стадиях, без закрытых и мёртвых
  const ACTIVE_STAGES = new Set(['site_ready','to_call','no_answer','reached','qualified','link_sent','negotiating','callback'])
  const nInWork = cleanLeads.filter((l) =>
    ACTIVE_STAGES.has(l.sales_stage) && l.qualification !== 'disqualified'
  ).length

  // Прогноз воронки ₽ = Σ AVG_DEAL × P(stage)
  const pipelineSum = cleanLeads.reduce((s, l) => {
    if (l.sales_stage === 'won' || l.sales_stage === 'lost' || l.qualification === 'disqualified') return s
    return s + AVG_DEAL * (STAGE_PROB[l.sales_stage] ?? 0)
  }, 0)
  const wonSum = nWon * AVG_DEAL

  // Топ-лиды: только чистые + без стоп-тегов + без своего сайта + перспективные
  const topLeads = cleanLeads
    .filter((l) => !l.website_url)
    .filter((l) => l.qualification !== 'disqualified')
    .filter((l) => !['won', 'lost'].includes(l.sales_stage))
    .sort((a, b) => {
      // Сначала горячие (visits>0), потом по rating × completeness
      const aHot = (a.visits_count ?? 0) > 0 ? 1000 : 0
      const bHot = (b.visits_count ?? 0) > 0 ? 1000 : 0
      const aScore = aHot + (a.rating ?? 0) * (a.completeness_score ?? 0.5) * 10
      const bScore = bHot + (b.rating ?? 0) * (b.completeness_score ?? 0.5) * 10
      return bScore - aScore
    })
    .slice(0, 6)

  // Ниши (только чистые)
  const niches: Record<string, { count: number; ratingSum: number; ratingN: number }> = {}
  for (const l of cleanLeads) {
    const key = nicheMeta(l.niche).label
    const n = niches[key] ?? { count: 0, ratingSum: 0, ratingN: 0 }
    n.count++
    if (l.rating) { n.ratingSum += l.rating; n.ratingN++ }
    niches[key] = n
  }

  const avgRating = cleanLeads.filter(l => l.rating).reduce((s, l) => s + (l.rating ?? 0), 0)
    / Math.max(1, cleanLeads.filter(l => l.rating).length)

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white px-8 py-7">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">🎯 Мечта — Лендинг-фабрика</h1>
              <p className="text-white/80 text-sm mt-1">
                Парсим бизнес Москвы → генерируем готовые сайты → продаём за 25 000 ₽ под ключ
              </p>
            </div>
            <Link href="/dream/leads" className="bg-white text-purple-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90">
              Все лиды →
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* 4 big metrics — все по чистым лидам */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Всего лидов"
            value={String(cleanLeads.length)}
            sub={`средний ⭐ ${avgRating.toFixed(1)}${musorCount > 0 ? ` · +${musorCount} в мусоре` : ''}`}
            accent="#6366f1"
          />
          <MetricCard label="В работе" value={String(nInWork)} sub="активные стадии воронки" accent="#f59e0b" />
          <MetricCard label="Прогноз воронки" value={fmtMoney(pipelineSum)} sub="взвешенный по стадиям" accent="#7c3aed" />
          <MetricCard label="Закрыто" value={fmtMoney(wonSum)} sub={`${nWon} сделок`} accent="#16a34a" />
        </div>

        {/* 2 columns: funnel + top leads */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Воронка (только рабочие)</h2>
            <p className="text-[11px] text-gray-500 mb-4">
              {cleanLeads.length} чистых лидов · {nDead} мёртвых отдельно · {musorCount} в мусоре исключены
            </p>
            <div className="space-y-2.5">
              {FUNNEL.map((s) => {
                const pct = Math.round((s.count / maxN) * 100)
                const sharePct = cleanLeads.length ? Math.round((s.count / cleanLeads.length) * 100) : 0
                return (
                  <div key={s.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{s.emoji} {s.label}</span>
                      <span className="font-bold text-gray-900">{s.count} <span className="text-gray-400 font-normal">({sharePct}%)</span></span>
                    </div>
                    <div className="bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
              <span>💀 Мёртвые: <b>{nDead}</b></span>
              <span>❌ Отказы: <b>{nLost}</b></span>
              <span className="ml-auto">🗑 Мусор (исключён): <b>{musorCount}</b></span>
            </div>
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
                  const nm = nicheMeta(l.niche)
                  const isHot = (l.visits_count ?? 0) > 0
                  return (
                    <li key={l.id}>
                      <Link href={`/dream/leads/${l.slug}`} className="block hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="font-semibold text-gray-900 truncate flex-1">{l.name}</span>
                          {isHot && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">🔥 {l.visits_count}×</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${salesStageCls(l.sales_stage)}`}>
                            {SALES_STAGE_RU[l.sales_stage] ?? l.sales_stage}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {nm.emoji} {nm.label} · ⭐ {l.rating ?? '—'} · {l.reviews_count ?? 0} отз
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Niches breakdown — только по чистым */}
        {Object.keys(niches).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ниши (чистые лиды)</h2>
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
                Парсер ничего не пушил. Эндпоинт: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">POST /api/dream/leads/import</code>
              </div>
            ) : (
              <ul className="space-y-2">
                {parserRuns.map((r: any) => (
                  <li key={r.id} className="border border-gray-100 rounded p-3 text-sm">
                    <div className="font-medium">{r.source ?? '—'} · {r.mode ?? '—'}</div>
                    <div className="text-xs text-gray-500">
                      {r.imported ?? 0}/{r.found ?? 0} лидов · {timeAgo(r.started_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">📜 Последние действия</h2>
            {recentActivities.length === 0 ? (
              <div className="text-sm text-gray-500 italic">Пока тихо.</div>
            ) : (
              <ul className="space-y-2">
                {recentActivities.map((a: any) => (
                  <li key={a.id} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{a.title ?? a.type}</span>
                      <span className="text-xs text-gray-400">{timeAgo(a.ts ?? a.created_at)}</span>
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

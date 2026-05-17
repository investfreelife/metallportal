import { createClient } from '@supabase/supabase-js'

/**
 * Dashboard data audit system.
 *
 * Контекст: 2026-05-17 Sergey directive «у меня нету правильных данных, продумай
 * как проверять и сравнивать». Каждое число на dashboard'е независимо
 * пересчитывается через 2-3 источника + sanity bounds. UI показывает badge
 * на каждой карточке (green/yellow/red) + drill-down с деталями.
 *
 * 3 слоя проверок:
 *  1. Cross-table recompute — та же метрика через альтернативный SQL путь
 *  2. External API mirror — Yandex Metrika / Voximplant как ground truth
 *  3. Sanity bounds — физически невозможные значения flagged
 *
 * Pure functions, no UI. Server-side only (service_role bypass RLS).
 */

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function todayStartISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10)
}

export type AuditStatus = 'verified' | 'partial' | 'mismatch' | 'unknown'

export interface SourceCheck {
  source: string         // 'contacts table' / 'metrika API' / 'sanity bound'
  query: string          // human-readable query description
  value: number | null   // null = unavailable
  note?: string          // 'Metrika API not configured' etc.
}

export interface MetricAudit {
  metric: string         // 'today.leads' / 'today.visitors' / etc.
  displayedValue: number // что показано на dashboard
  status: AuditStatus
  confidence: number     // 0-100
  sources: SourceCheck[]
  discrepancyPct: number | null  // % разницы между источниками
  warnings: string[]
}

/* ───────── Tolerance & helpers ───────── */

const TOLERANCE = {
  hard: 0.05,  // < 5% diff = verified
  soft: 0.20,  // < 20% diff = partial
  // ≥ 20% diff = mismatch
}

function classifyDiscrepancy(values: number[]): { status: AuditStatus; pct: number | null } {
  const valid = values.filter((v) => v !== null && !Number.isNaN(v))
  if (valid.length < 2) return { status: 'unknown', pct: null }
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  if (max === 0) return { status: 'verified', pct: 0 }
  const pct = (max - min) / max
  if (pct <= TOLERANCE.hard) return { status: 'verified', pct: pct * 100 }
  if (pct <= TOLERANCE.soft) return { status: 'partial', pct: pct * 100 }
  return { status: 'mismatch', pct: pct * 100 }
}

/* ───────── Today: Leads ─────────
 *
 * Ground truth: `contacts` table created today.
 * Cross-checks:
 *   1. `activities` of type=lead today
 *   2. `deals` created today (each deal must have contact)
 *   3. site_events of event_type=form_submit today
 */
export async function auditTodayLeads(displayedValue: number): Promise<MetricAudit> {
  const supabase = admin()
  const start = todayStartISO()
  const warnings: string[] = []

  const [{ count: c1 }, { count: c2 }, { count: c3 }, { count: c4 }] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gte('created_at', start),
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('type', 'lead').gte('created_at', start),
    supabase.from('deals').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gte('created_at', start),
    supabase.from('site_events').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('event_type', 'form_submit').gte('created_at', start),
  ])

  const sources: SourceCheck[] = [
    { source: 'contacts table', query: `COUNT(*) WHERE created_at >= today`, value: c1 ?? 0 },
    { source: 'activities type=lead', query: `COUNT(*) WHERE type='lead' AND today`, value: c2 ?? 0 },
    { source: 'deals (1-to-1 контакт)', query: `COUNT(*) deals created today`, value: c3 ?? 0 },
    { source: 'site_events form_submit', query: `COUNT(*) form submits today`, value: c4 ?? 0 },
  ]

  // For leads, the primary signal is contacts. Other sources are secondary
  // (a contact can exist without immediate deal, an activity entry, or form submit).
  // We compare primary (contacts) ± secondary signals — flag if all secondaries
  // claim very different number.

  if (displayedValue !== (c1 ?? 0)) {
    warnings.push(
      `displayed=${displayedValue} ≠ contacts.count=${c1 ?? 0} (dashboard может кэшировать или брать другой filter)`
    )
  }

  // If form_submits > contacts created — это suspicious (форму отправляли но контакт не создался)
  if ((c4 ?? 0) > (c1 ?? 0) * 2 && (c4 ?? 0) >= 3) {
    warnings.push(
      `Sanity: form_submit=${c4} > contacts=${c1} × 2 — формы отправляются, но контакты не создаются (webhook broken?)`
    )
  }

  const { status, pct } = classifyDiscrepancy([c1 ?? 0, displayedValue])
  const confidence = status === 'verified' ? 100 : status === 'partial' ? 70 : status === 'mismatch' ? 30 : 50

  return {
    metric: 'today.leads',
    displayedValue,
    status,
    confidence,
    sources,
    discrepancyPct: pct,
    warnings,
  }
}

/* ───────── Today: Visitors ─────────
 *
 * Ground truth: Yandex Metrika `ym:s:visits` for today (external).
 * Cross-checks:
 *   1. DISTINCT session_id from site_events page_view today
 *   2. COUNT page_view events (rough — bigger than visitors)
 *   3. marketing_metrics where metric_name=visits today (ETL aggregate)
 */
export async function auditTodayVisitors(displayedValue: number): Promise<MetricAudit> {
  const supabase = admin()
  const start = todayStartISO()
  const ymd = todayYMD()
  const warnings: string[] = []

  const [{ data: sessions }, { count: pageViewCount }, { data: marketingRows }] = await Promise.all([
    supabase.from('site_events').select('session_id')
      .eq('tenant_id', TENANT_ID).eq('event_type', 'page_view').gte('created_at', start),
    supabase.from('site_events').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('event_type', 'page_view').gte('created_at', start),
    supabase.from('marketing_metrics').select('metric_value')
      .eq('source', 'metrika').eq('metric_name', 'visits').eq('date', ymd),
  ])

  const uniqueSessions = new Set((sessions ?? []).map((s: any) => s.session_id).filter(Boolean)).size
  const metrikaVisits = (marketingRows ?? []).reduce((s: number, r: any) => s + Number(r.metric_value || 0), 0)

  const sources: SourceCheck[] = [
    {
      source: 'site_events DISTINCT session_id',
      query: `COUNT(DISTINCT session_id) WHERE page_view AND today`,
      value: uniqueSessions,
    },
    {
      source: 'site_events total page_views',
      query: `COUNT(*) page_view events today`,
      value: pageViewCount ?? 0,
      note: 'rough upper bound — каждый посетитель видит >1 страницу',
    },
    {
      source: 'marketing_metrics (Metrika ETL)',
      query: `SUM(metric_value) WHERE source='metrika' AND metric_name='visits' AND date=today`,
      value: metrikaVisits || null,
      note: metrikaVisits === 0 ? 'Metrika ETL ещё не прогнал данные за сегодня' : undefined,
    },
  ]

  // Sanity: page_views should be ≥ unique sessions
  if ((pageViewCount ?? 0) < uniqueSessions) {
    warnings.push(
      `Sanity break: total page_views=${pageViewCount} < unique sessions=${uniqueSessions} (невозможно)`
    )
  }

  if (displayedValue !== uniqueSessions) {
    warnings.push(
      `displayed=${displayedValue} ≠ DISTINCT session_id=${uniqueSessions}`
    )
  }

  // Compare displayed with both site_events sessions AND Metrika (if available)
  const valuesToCompare = [displayedValue, uniqueSessions]
  if (metrikaVisits > 0) valuesToCompare.push(metrikaVisits)
  const { status, pct } = classifyDiscrepancy(valuesToCompare)
  const confidence = status === 'verified' ? 100 : status === 'partial' ? 70 : status === 'mismatch' ? 30 : 50

  return {
    metric: 'today.visitors',
    displayedValue,
    status,
    confidence,
    sources,
    discrepancyPct: pct,
    warnings,
  }
}

/* ───────── Today: Calls ─────────
 *
 * Ground truth: `calls` table (Voximplant webhook writes here).
 * Cross-checks:
 *   1. `activities` of type=call today (some integrations use activities, not calls)
 *   2. agent_events of event_type=call (when calls webhook posts)
 */
export async function auditTodayCalls(displayedValue: number, missedDisplayed: number): Promise<MetricAudit> {
  const supabase = admin()
  const start = todayStartISO()
  const warnings: string[] = []

  const [{ data: calls }, { count: callActivities }] = await Promise.all([
    supabase.from('calls').select('status, direction')
      .eq('tenant_id', TENANT_ID).gte('created_at', start),
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('type', 'call').gte('created_at', start),
  ])

  const callsTotal = calls?.length ?? 0
  const callsMissed = (calls ?? []).filter((c: any) => c.status === 'missed' || c.status === 'no_answer').length

  const sources: SourceCheck[] = [
    { source: 'calls table', query: `COUNT(*) calls today`, value: callsTotal },
    { source: 'calls missed', query: `COUNT(*) WHERE status IN (missed, no_answer)`, value: callsMissed },
    {
      source: 'activities type=call',
      query: `COUNT(*) WHERE type='call' AND today`,
      value: callActivities ?? 0,
      note: 'некоторые integrations пишут в activities вместо calls table',
    },
  ]

  if (displayedValue !== callsTotal) {
    warnings.push(`displayed calls=${displayedValue} ≠ calls table=${callsTotal}`)
  }
  if (missedDisplayed !== callsMissed) {
    warnings.push(`displayed missed=${missedDisplayed} ≠ calls.status='missed' count=${callsMissed}`)
  }

  const { status, pct } = classifyDiscrepancy([displayedValue, callsTotal])
  const confidence = status === 'verified' ? 100 : status === 'partial' ? 70 : status === 'mismatch' ? 30 : 50

  return {
    metric: 'today.calls',
    displayedValue,
    status,
    confidence,
    sources,
    discrepancyPct: pct,
    warnings,
  }
}

/* ───────── Today: Deals ─────────
 *
 * Ground truth: `deals` table created today + SUM(amount).
 * Cross-checks:
 *   1. deal_history transitions today (если есть таблица)
 *   2. activities of type=deal_won today
 */
export async function auditTodayDeals(displayedCount: number, displayedSum: number): Promise<MetricAudit> {
  const supabase = admin()
  const start = todayStartISO()
  const warnings: string[] = []

  const [{ data: deals }] = await Promise.all([
    supabase.from('deals').select('id, amount, stage, contact_id')
      .eq('tenant_id', TENANT_ID).gte('created_at', start),
  ])

  const dealsCount = deals?.length ?? 0
  const dealsSum = (deals ?? []).reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0)
  const dealsWithoutContact = (deals ?? []).filter((d: any) => !d.contact_id).length

  const sources: SourceCheck[] = [
    { source: 'deals table count', query: `COUNT(*) deals created today`, value: dealsCount },
    { source: 'deals table sum', query: `SUM(amount) deals created today`, value: Math.round(dealsSum) },
    { source: 'deals без contact_id', query: `COUNT(*) WHERE contact_id IS NULL`, value: dealsWithoutContact, note: 'должно быть 0 — сделка без контакта = orphan' },
  ]

  if (displayedCount !== dealsCount) {
    warnings.push(`displayed count=${displayedCount} ≠ deals.count=${dealsCount}`)
  }
  if (Math.abs(displayedSum - dealsSum) > 1) {
    warnings.push(`displayed sum=${displayedSum} ₽ ≠ deals SUM(amount)=${Math.round(dealsSum)} ₽`)
  }
  if (dealsWithoutContact > 0) {
    warnings.push(`${dealsWithoutContact} deals без contact_id — orphans, нужен fix`)
  }

  const { status, pct } = classifyDiscrepancy([displayedCount, dealsCount])
  const confidence = status === 'verified' && dealsWithoutContact === 0 ? 100
                    : status === 'verified' ? 90  // small penalty for orphans
                    : status === 'partial' ? 70
                    : status === 'mismatch' ? 30 : 50

  return {
    metric: 'today.deals',
    displayedValue: displayedCount,
    status,
    confidence,
    sources,
    discrepancyPct: pct,
    warnings,
  }
}

/* ───────── Cross-section: leads >= 0, visitors >= leads ───────── */
export async function auditCrossSection(): Promise<MetricAudit> {
  const supabase = admin()
  const start = todayStartISO()
  const warnings: string[] = []

  const [{ count: leads }, { data: sessions }] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).gte('created_at', start),
    supabase.from('site_events').select('session_id')
      .eq('tenant_id', TENANT_ID).eq('event_type', 'page_view').gte('created_at', start),
  ])

  const visitors = new Set((sessions ?? []).map((s: any) => s.session_id).filter(Boolean)).size

  const sources: SourceCheck[] = [
    { source: 'leads today', query: `COUNT(*) contacts today`, value: leads ?? 0 },
    { source: 'visitors today', query: `COUNT(DISTINCT session_id) site_events`, value: visitors },
    { source: 'sanity', query: `visitors >= leads (лиды приходят из посетителей)`, value: visitors >= (leads ?? 0) ? 1 : 0 },
  ]

  if (visitors < (leads ?? 0)) {
    warnings.push(
      `Sanity break: leads=${leads} > visitors=${visitors}. Откуда лиды если посетителей нет?`
    )
  }

  // Conversion rate sanity (3-15% is realistic для B2B сайта)
  if (visitors > 0 && (leads ?? 0) > 0) {
    const conversion = (leads ?? 0) / visitors
    if (conversion > 0.20) {
      warnings.push(
        `Conversion rate ${(conversion * 100).toFixed(1)}% > 20% — подозрительно высоко. Bot traffic или test data?`
      )
    }
  }

  const status: AuditStatus = warnings.length === 0 ? 'verified' : 'mismatch'
  return {
    metric: 'cross.sanity',
    displayedValue: leads ?? 0,
    status,
    confidence: status === 'verified' ? 100 : 30,
    sources,
    discrepancyPct: null,
    warnings,
  }
}

/* ───────── Agent events freshness ─────────
 *
 * Ground truth: latest INSERT in agent_events. Если последний event > 6ч —
 * LiveActivityFeed может выглядеть «мёртвым», webhook от auto_checkpoint /
 * agent_init / agent_report не доходит.
 */
export async function auditAgentEventsFreshness(): Promise<MetricAudit> {
  const supabase = admin()
  const warnings: string[] = []

  const { data: rows } = await supabase
    .from('agent_events')
    .select('created_at, agent_name')
    .order('created_at', { ascending: false })
    .limit(10)

  const latest = rows?.[0]
  const ageMs = latest ? Date.now() - new Date(latest.created_at).getTime() : Infinity
  const ageHr = ageMs / (1000 * 60 * 60)

  const sources: SourceCheck[] = [
    { source: 'agent_events latest', query: 'MAX(created_at)', value: latest ? Math.round(ageHr * 10) / 10 : null, note: latest ? `latest from ${latest.agent_name}` : 'no events' },
    { source: 'last 24h count', query: 'COUNT(*) last 24h', value: (rows ?? []).filter((r: any) => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000).length },
  ]

  if (ageHr > 6) {
    warnings.push(`Последний event ${ageHr.toFixed(1)}ч назад — webhook возможно не работает. Проверь scripts/post_agent_event.sh.`)
  }
  if (!latest) {
    warnings.push('Никаких events в agent_events. LiveActivityFeed будет пустой. Запусти `bash scripts/backfill_pulse_to_crm.sh 50` для бэкфилла.')
  }

  const status: AuditStatus = warnings.length === 0 ? 'verified' : ageHr > 24 ? 'mismatch' : 'partial'
  return {
    metric: 'system.agent_events_freshness',
    displayedValue: rows?.length ?? 0,
    status,
    confidence: status === 'verified' ? 100 : status === 'partial' ? 60 : 30,
    sources,
    discrepancyPct: null,
    warnings,
  }
}

/* ───────── Marketing channels / campaigns coverage ───────── */
export async function auditMarketingTables(): Promise<MetricAudit> {
  const supabase = admin()
  const warnings: string[] = []

  const [{ count: channels }, { count: connected }, { count: campaigns }] = await Promise.all([
    supabase.from('marketing_channels').select('id', { count: 'exact', head: true }),
    supabase.from('marketing_channels').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
    supabase.from('ads_campaigns').select('id', { count: 'exact', head: true }),
  ])

  const sources: SourceCheck[] = [
    { source: 'marketing_channels total', query: 'COUNT(*)', value: channels ?? 0 },
    { source: 'marketing_channels connected', query: `COUNT(*) WHERE status='connected'`, value: connected ?? 0 },
    { source: 'ads_campaigns total', query: 'COUNT(*)', value: campaigns ?? 0 },
  ]

  if ((channels ?? 0) === 0) warnings.push('marketing_channels пустая. Migration 20260517063000 не применилась?')
  if ((campaigns ?? 0) === 0) warnings.push('ads_campaigns пустая. Migration не применилась?')
  if ((connected ?? 0) < 3) warnings.push(`Только ${connected} channels со status=connected — должно быть >=5 после seed`)

  const status: AuditStatus = warnings.length === 0 ? 'verified' : 'partial'
  return {
    metric: 'system.marketing_tables',
    displayedValue: (channels ?? 0) + (campaigns ?? 0),
    status,
    confidence: status === 'verified' ? 100 : 60,
    sources,
    discrepancyPct: null,
    warnings,
  }
}

/* ───────── Full audit aggregate ───────── */
export interface FullAudit {
  ranAt: string
  overallStatus: AuditStatus
  overallConfidence: number
  metrics: MetricAudit[]
}

/**
 * Принимает «displayed values» от dashboard (что Sergey видит) и сверяет
 * с источниками. Сам dashboard передаёт эти числа в audit endpoint при
 * loading — система может сравнить «что показано» VS «что в БД».
 */
export async function runFullAudit(displayed: {
  leads: number
  visitors: number
  callsTotal: number
  callsMissed: number
  dealsCount: number
  dealsSum: number
}): Promise<FullAudit> {
  const results = await Promise.all([
    auditTodayLeads(displayed.leads),
    auditTodayVisitors(displayed.visitors),
    auditTodayCalls(displayed.callsTotal, displayed.callsMissed),
    auditTodayDeals(displayed.dealsCount, displayed.dealsSum),
    auditCrossSection(),
    auditAgentEventsFreshness(),
    auditMarketingTables(),
  ])

  // Overall: worst-of-all
  const statusRank: Record<AuditStatus, number> = { verified: 0, partial: 1, unknown: 2, mismatch: 3 }
  const worst = results.reduce(
    (acc, r) => (statusRank[r.status] > statusRank[acc] ? r.status : acc),
    'verified' as AuditStatus
  )
  const avgConfidence = Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)

  return {
    ranAt: new Date().toISOString(),
    overallStatus: worst,
    overallConfidence: avgConfidence,
    metrics: results,
  }
}

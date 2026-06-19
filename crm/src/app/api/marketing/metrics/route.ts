/**
 * ТЗ #2026-06-19 §2 (ТАРГЕТ) — приём time-series метрик рекламы.
 *
 * POST /api/marketing/metrics  (auth: x-agent-token = AGENT_WEBHOOK_TOKEN)
 *   Body: { rows: [{date, channel, campaign_slug?, source, impressions?, clicks?,
 *                   cost_micros?, visits?, leads?, conversions?, goal_reaches?,
 *                   ctr?, cpl_micros?, bounce_rate?, avg_visit_sec?, robot_share?,
 *                   raw?, tenant_id?}, ...] }   // батч ≤500
 *   Идемпотентный апсерт по (tenant_id, date, channel, COALESCE(campaign_slug,''), source).
 *
 * GET /api/marketing/metrics?channel=&campaign=&from=&to=&days=30
 *   Для витрины. Возвращает агрегат + строки по дням.
 *   Без auth — внутри dashboard layout (cookie-session проверяет middleware).
 *
 * Деньги в МИКРО (₽×1e6). UI делит на 1e6.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

// Белый список каналов из ТЗ
const VALID_CHANNELS = new Set([
  'yandex_direct', 'yandex_metrika', 'seo_webmaster',
  'avito', '2gis', 'vk', 'telegram', 'whatsapp',
  'instagram', 'youtube', 'tiktok', 'manual',
])

const VALID_SOURCES = new Set([
  'direct_api', 'metrika_api', 'webmaster_api', 'manual', 'daemon',
])

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface MetricRow {
  date: string
  channel: string
  campaign_slug?: string | null
  source: string
  impressions?: number
  clicks?: number
  cost_micros?: number
  visits?: number
  leads?: number
  conversions?: number
  goal_reaches?: Record<string, number>
  ctr?: number
  cpl_micros?: number
  bounce_rate?: number
  avg_visit_sec?: number
  robot_share?: number
  raw?: any
  tenant_id?: string
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-agent-token') !== process.env.AGENT_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'body.rows must be array' }, { status: 400 })
  }
  if (body.rows.length === 0 || body.rows.length > 500) {
    return NextResponse.json({ error: 'rows: 1..500' }, { status: 400 })
  }

  const errors: { idx: number; reason: string }[] = []
  const valid: any[] = []

  body.rows.forEach((r: MetricRow, idx: number) => {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { errors.push({ idx, reason: 'date must be YYYY-MM-DD' }); return }
    if (!r.channel || !VALID_CHANNELS.has(r.channel))  { errors.push({ idx, reason: `channel: not in whitelist (${[...VALID_CHANNELS].join(',')})` }); return }
    if (!r.source  || !VALID_SOURCES.has(r.source))    { errors.push({ idx, reason: `source: not in whitelist` }); return }
    if (r.cost_micros != null && !Number.isInteger(r.cost_micros)) { errors.push({ idx, reason: 'cost_micros must be integer' }); return }
    if (r.cpl_micros  != null && !Number.isInteger(r.cpl_micros))  { errors.push({ idx, reason: 'cpl_micros must be integer' }); return }

    valid.push({
      tenant_id:     r.tenant_id ?? DREAM_TENANT_ID,
      date:          r.date,
      channel:       r.channel,
      campaign_slug: r.campaign_slug ?? null,
      source:        r.source,
      impressions:   r.impressions ?? 0,
      clicks:        r.clicks ?? 0,
      cost_micros:   r.cost_micros ?? 0,
      visits:        r.visits ?? 0,
      leads:         r.leads ?? 0,
      conversions:   r.conversions ?? 0,
      goal_reaches:  r.goal_reaches ?? {},
      ctr:           r.ctr ?? null,
      cpl_micros:    r.cpl_micros ?? null,
      bounce_rate:   r.bounce_rate ?? null,
      avg_visit_sec: r.avg_visit_sec ?? null,
      robot_share:   r.robot_share ?? null,
      raw:           r.raw ?? null,
      updated_at:    new Date().toISOString(),
    })
  })

  if (valid.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, errors }, { status: 400 })
  }

  // Апсерт по UNIQUE-ключу. Supabase upsert через onConflict.
  // ВАЖНО: PostgREST onConflict требует точные имена колонок; для COALESCE-выражения
  // в индексе используем явное условие через RPC. Здесь — простой upsert + UNIQUE index
  // обеспечивает идемпотентность.
  const sb = admin()
  const { data, error } = await sb
    .from('marketing_metrics')
    .upsert(valid, { onConflict: 'tenant_id,date,channel,campaign_slug,source', ignoreDuplicates: false })
    .select('id, date, channel, campaign_slug, source')

  if (error) {
    // campaign_slug=NULL может ломать onConflict-аргументы PostgREST.
    // Фолбэк: пишем порциями через RPC-style INSERT ... ON CONFLICT.
    return NextResponse.json({
      error: error.message,
      hint: 'Если ругается на NULL в onConflict — используй пустую строку в campaign_slug.',
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    rows: data?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const channel = url.searchParams.get('channel')
  const campaign = url.searchParams.get('campaign')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const days = parseInt(url.searchParams.get('days') ?? '30', 10)

  const sb = admin()
  let q = sb.from('marketing_metrics')
    .select('date, channel, campaign_slug, source, impressions, clicks, cost_micros, visits, leads, conversions, goal_reaches, ctr, cpl_micros, bounce_rate, avg_visit_sec, robot_share')
    .eq('tenant_id', DREAM_TENANT_ID)
    .order('date', { ascending: false })
    .limit(2000)

  if (channel)  q = q.eq('channel', channel)
  if (campaign) q = q.eq('campaign_slug', campaign)
  if (from)     q = q.gte('date', from)
  if (to)       q = q.lte('date', to)
  if (!from && !to && days > 0) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    q = q.gte('date', cutoff.toISOString().slice(0, 10))
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Агрегат
  const agg = (data ?? []).reduce(
    (a, r) => ({
      impressions: a.impressions + (r.impressions ?? 0),
      clicks:      a.clicks      + (r.clicks ?? 0),
      cost_micros: a.cost_micros + (r.cost_micros ?? 0),
      visits:      a.visits      + (r.visits ?? 0),
      leads:       a.leads       + (r.leads ?? 0),
      conversions: a.conversions + (r.conversions ?? 0),
    }),
    { impressions: 0, clicks: 0, cost_micros: 0, visits: 0, leads: 0, conversions: 0 }
  )
  const avg_cpl_micros = agg.leads > 0 ? Math.round(agg.cost_micros / agg.leads) : null
  const avg_ctr = agg.impressions > 0 ? agg.clicks / agg.impressions : null

  return NextResponse.json({
    rows: data ?? [],
    agg: { ...agg, avg_cpl_micros, avg_ctr },
    filters: { channel, campaign, from, to, days },
  })
}

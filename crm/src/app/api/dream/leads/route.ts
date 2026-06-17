import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/dream/leads — список лидов проекта «Мечта».
 *
 * Tenant: dream (slug). Sergey directive — отдельный раздел в CRM
 * для лендинг-фабрики (парсинг Яндекс.Карт + outreach + продажа за 25K ₽).
 *
 * Filters: ?status / ?niche / ?min_rating / ?search.
 */

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const niche = url.searchParams.get('niche')
  const minRating = url.searchParams.get('min_rating')
  const search = url.searchParams.get('search')?.trim() ?? ''

  const supabase = admin()
  let query = supabase
    .from('dream_leads')
    .select('*')
    .eq('tenant_id', DREAM_TENANT_ID)
    .order('rating', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(300)

  if (status && status !== 'all') query = query.eq('status', status)
  if (niche) query = query.eq('niche', niche)
  if (minRating) query = query.gte('rating', parseFloat(minRating))
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%,niche.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate stats for sidebar/header badges
  const { data: allLeads } = await supabase
    .from('dream_leads')
    .select('status, price, rating, niche')
    .eq('tenant_id', DREAM_TENANT_ID)

  const byStatus: Record<string, number> = {}
  let totalForecast = 0
  let totalWon = 0
  const niches: Record<string, number> = {}
  for (const l of allLeads ?? []) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
    if (['outreach', 'contacted', 'hot', 'proposal'].includes(l.status)) {
      totalForecast += l.price ?? 25000
    }
    if (l.status === 'won') totalWon += l.price ?? 25000
    if (l.niche) niches[l.niche] = (niches[l.niche] ?? 0) + 1
  }

  return NextResponse.json({
    leads: data ?? [],
    stats: {
      total: allLeads?.length ?? 0,
      by_status: byStatus,
      forecast_pipeline: totalForecast,
      won_total: totalWon,
      niches: Object.entries(niches).map(([n, c]) => ({ niche: n, count: c })).sort((a, b) => b.count - a.count).slice(0, 8),
    },
  }, { headers: { 'cache-control': 'no-store' } })
}

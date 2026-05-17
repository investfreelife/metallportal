import { NextRequest, NextResponse } from 'next/server'
import { runFullAudit } from '@/lib/dashboard-audit'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard-audit
 *
 * Runs full data audit and returns JSON. Authenticated (via session cookie)
 * — это admin tool, не для public exposure.
 *
 * Query params (optional — если переданы, сравнивает с displayed):
 *   ?leads=5&visitors=120&calls_total=3&calls_missed=1&deals_count=2&deals_sum=245000
 *
 * Без params — берёт «what should be displayed» из БД (что purely в БД),
 * и потом сверяет с alternative источниками.
 *
 * URGENT 2026-05-17 Sergey: «у меня нету правильных данных, проверь сам».
 */

export const dynamic = 'force-dynamic'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function todayStartISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  let displayed = {
    leads: parseInt(url.searchParams.get('leads') ?? '', 10),
    visitors: parseInt(url.searchParams.get('visitors') ?? '', 10),
    callsTotal: parseInt(url.searchParams.get('calls_total') ?? '', 10),
    callsMissed: parseInt(url.searchParams.get('calls_missed') ?? '', 10),
    dealsCount: parseInt(url.searchParams.get('deals_count') ?? '', 10),
    dealsSum: parseInt(url.searchParams.get('deals_sum') ?? '', 10),
  }

  // If no displayed values provided, fetch from DB (what dashboard *should* show)
  if ([displayed.leads, displayed.visitors, displayed.callsTotal, displayed.dealsCount].some(Number.isNaN)) {
    const supabase = await createClient()
    const start = todayStartISO()

    const [
      { count: leads },
      { data: callsRaw },
      { data: visitsRaw },
      { data: dealsRaw },
    ] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID).gte('created_at', start),
      supabase.from('calls').select('status').eq('tenant_id', TENANT_ID).gte('created_at', start),
      supabase.from('site_events').select('session_id').eq('tenant_id', TENANT_ID).eq('event_type', 'page_view').gte('created_at', start),
      supabase.from('deals').select('amount').eq('tenant_id', TENANT_ID).gte('created_at', start),
    ])

    const callsTotal = callsRaw?.length ?? 0
    const callsMissed = (callsRaw ?? []).filter((c: any) => c.status === 'missed' || c.status === 'no_answer').length
    const visitors = new Set((visitsRaw ?? []).map((s: any) => s.session_id).filter(Boolean)).size
    const dealsCount = dealsRaw?.length ?? 0
    const dealsSum = (dealsRaw ?? []).reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0)

    displayed = {
      leads: leads ?? 0,
      visitors,
      callsTotal,
      callsMissed,
      dealsCount,
      dealsSum: Math.round(dealsSum),
    }
  }

  try {
    const audit = await runFullAudit(displayed)
    return NextResponse.json(audit, {
      headers: { 'cache-control': 'no-store, max-age=0' },
    })
  } catch (e: any) {
    console.error('[dashboard-audit] error', e)
    return NextResponse.json({ error: 'audit_failed', detail: e?.message }, { status: 500 })
  }
}

/**
 * Журнал звонков + KPI (TASK_011 §3).
 *
 * GET /api/dream/calls
 *   ?from=ISO  ?to=ISO  ?result=success|unsuccessful  ?qualification=qualified|... ?lead_id=N
 *
 * Возвращает:
 *   {
 *     calls: [{...row, lead_name, lead_slug}],
 *     kpi: {total, completed, completed_pct, qualified_pct, link_sent_pct, won, total_cost}
 *   }
 *
 * Heavy поля (transcript, recording_url) включены в список — расшифровка
 * показывается из модалки без доп-fetch. Если позже захочется lazy — добавить
 * `?light=1` и не select-ить эти поля.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireDreamAuth } from '@/lib/dream/requireAuth'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

export async function GET(req: NextRequest) {
  // TASK_030 #3: defence-in-depth auth.
  const __auth = await requireDreamAuth(req)
  if (!__auth.ok) return __auth.res

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to   = url.searchParams.get('to')
  const result = url.searchParams.get('result')
  const qualification = url.searchParams.get('qualification')
  const leadIdStr = url.searchParams.get('lead_id')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let q = sb.from('dream_calls')
    .select('id, lead_id, conversation_id, direction, from_number, to_number, status, result, qualification, summary, transcript, duration_sec, sms_sent, recording_url, cost, started_at, ended_at, created_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(500)

  if (from) q = q.gte('created_at', from)
  if (to)   q = q.lte('created_at', to)
  if (result) q = q.eq('result', result)
  if (qualification) q = q.eq('qualification', qualification)
  if (leadIdStr) q = q.eq('lead_id', parseInt(leadIdStr, 10))

  const { data: calls, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Подтягиваем имена лидов одним запросом
  const leadIds = Array.from(new Set((calls ?? []).map((c: any) => c.lead_id).filter(Boolean)))
  let leadMap = new Map<number, { name: string; slug: string }>()
  if (leadIds.length > 0) {
    const { data: leads } = await sb.from('dream_leads').select('id, name, slug').in('id', leadIds)
    leadMap = new Map((leads ?? []).map((l: any) => [l.id, { name: l.name, slug: l.slug }]))
  }
  const enriched = (calls ?? []).map((c: any) => ({
    ...c,
    lead_name: c.lead_id ? leadMap.get(c.lead_id)?.name ?? null : null,
    lead_slug: c.lead_id ? leadMap.get(c.lead_id)?.slug ?? null : null,
  }))

  // KPI
  const total = enriched.length
  const completed = enriched.filter((c: any) => c.status === 'completed').length
  const qualified = enriched.filter((c: any) => c.qualification === 'qualified').length
  const link_sent = enriched.filter((c: any) => c.sms_sent).length
  const won = enriched.filter((c: any) => c.qualification === 'qualified' && c.sms_sent).length
  const total_cost = enriched.reduce((s: number, c: any) => s + (Number(c.cost) || 0), 0)

  const kpi = {
    total,
    completed,
    completed_pct: total ? Math.round(100 * completed / total) : 0,
    qualified,
    qualified_pct: completed ? Math.round(100 * qualified / completed) : 0,
    link_sent,
    link_sent_pct: completed ? Math.round(100 * link_sent / completed) : 0,
    won,
    total_cost: Number(total_cost.toFixed(2)),
  }

  return NextResponse.json({ calls: enriched, kpi })
}

/**
 * Переключение sales_stage лида (TASK_011 §5).
 *
 * POST /api/dream/leads/[slug]/stage  body: { sales_stage, reason? }
 *
 * Auth: cookie-session (Sergey) ИЛИ x-agent-token (агент-продавец/звонилка).
 * При смене → INSERT в dream_activities (type='stage_change') для таймлайна.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

const VALID_STAGES = [
  'site_ready','to_call','no_answer','reached','qualified','disqualified',
  'link_sent','negotiating','callback','won','lost',
]

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  const agentToken = req.headers.get('x-agent-token')
  const agentName = req.headers.get('x-agent-name') || 'agent:seller'
  const isAgent = agentToken === process.env.AGENT_WEBHOOK_TOKEN
  if (!session && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const { sales_stage, reason } = await req.json().catch(() => ({}))

  if (!sales_stage || !VALID_STAGES.includes(sales_stage)) {
    return NextResponse.json({ error: `Invalid sales_stage. Must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: lead } = await sb.from('dream_leads')
    .select('id, tenant_id, sales_stage').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const actor = session ? session.login : agentName
  const from_stage = lead.sales_stage

  // UPDATE стадии
  const { error: updErr } = await sb.from('dream_leads')
    .update({ sales_stage, updated_at: new Date().toISOString() })
    .eq('id', lead.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // INSERT в таймлайн
  await sb.from('dream_activities').insert({
    tenant_id: lead.tenant_id, lead_id: lead.id,
    ts: new Date().toISOString(), type: 'stage_change',
    actor, title: `${from_stage ?? '—'} → ${sales_stage}`,
    body: reason || null, meta: { from_stage, to_stage: sales_stage },
  })

  return NextResponse.json({ ok: true, from: from_stage, to: sales_stage })
}

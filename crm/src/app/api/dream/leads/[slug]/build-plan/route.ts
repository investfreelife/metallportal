import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

/**
 * GET    /api/dream/leads/[slug]/build-plan
 * PATCH  /api/dream/leads/[slug]/build-plan   body: { build_status?, build_plan_json? }
 *
 * Контракт approval-workflow (TASK_CRM_approval_section.md, Sergey 2026-06-18):
 *
 *   parsed → plan_proposed → approved → built → chosen
 *
 * Кодер CRM подключит UI «🧩 Утверждение» к этим методам.
 * Парсер/агент-предлагатель плана пишет с x-agent-token.
 * Оператор (Sergey) меняет статус из UI (cookie-session).
 *
 * approved + build_approved_at + build_approved_by → агент-кодер видит, начинает сборку.
 */

const VALID_STATUSES = ['parsed', 'plan_proposed', 'approved', 'built', 'chosen']

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data, error } = await admin()
    .from('dream_leads')
    .select('slug, build_status, build_plan_json, build_approved_at, build_approved_by')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'lead not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Auth: либо session (Sergey из UI), либо agent-token (парсер с предложением плана)
  const session = await getSession()
  const agentToken = req.headers.get('x-agent-token')
  const isAgent = agentToken === process.env.AGENT_WEBHOOK_TOKEN

  if (!session && !isAgent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { build_status, build_plan_json } = body

  if (build_status && !VALID_STATUSES.includes(build_status)) {
    return NextResponse.json({ error: `Invalid build_status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  // Запрет на изменение approved/chosen агентом — только Sergey через UI
  const isApprovalStep = build_status === 'approved' || build_status === 'chosen'
  if (isApprovalStep && !session) {
    return NextResponse.json({ error: 'Approval/chosen — только оператор, не агент' }, { status: 403 })
  }

  const update: Record<string, any> = {}
  if (build_status) update.build_status = build_status
  if (build_plan_json !== undefined) update.build_plan_json = build_plan_json

  if (build_status === 'approved') {
    update.build_approved_at = new Date().toISOString()
    update.build_approved_by = session?.login ?? 'unknown'
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await admin()
    .from('dream_leads')
    .update(update)
    .eq('slug', slug)
    .select('slug, build_status, build_plan_json, build_approved_at, build_approved_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lead: data })
}

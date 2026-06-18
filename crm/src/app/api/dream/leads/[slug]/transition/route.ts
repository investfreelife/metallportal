/**
 * Перевод лида по воронке Мечты (build_status).
 *
 * 12 состояний:
 *   parsed → enriching → plan_proposed → approved → building → built →
 *   review_built → for_sale → selling → sold | lost | trash
 *
 * POST /api/dream/leads/[slug]/transition
 *   body: { to_status, reason?, trash_reason?, note? }
 *
 * Поля по AGENT_QUICK_START.md §0.5:
 *   - trash_reason: 'has_website' | 'wrong_niche' | 'wrong_city' | 'closed' |
 *                   'low_quality' | 'duplicate' | 'no_phone' | <свободный текст>
 *   - note: текст комментария оператора/агента про причину перехода (записывается
 *           в dream_lead_comments kind='fact' + в reason журнала перехода)
 *   - reason: legacy свободный текст (если только он передан — copy в журнал)
 *
 * Валидация:
 *  1. to_status в whitelist.
 *  2. Если автор-агент — переход разрешён только из AGENT_ALLOWED.
 *  3. Если на лиде активный блокер (dream_lead_blockers) и переход вперёд
 *     (не 'trash'/'lost') — требуется reason со словом «override» или «всё равно».
 *
 * Сайд-эффекты:
 *  - INSERT в dream_lead_transitions (журнал перехода).
 *  - При to='trash' с trash_reason → UPDATE dream_leads.trash_reason.
 *  - При to='trash'/'lost' с note → INSERT dream_lead_comments kind='fact'.
 *  - При to='approved' проставляются build_approved_at и build_approved_by.
 *  - dream_leads.updated_at = NOW().
 *
 * См. ARCHITECTURE.md раздел «Воронка» + AGENT_QUICK_START.md §0.5.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

const VALID = [
  'parsed','enriching','plan_proposed','approved','building','built',
  'review_built','for_sale','selling','sold','lost','trash',
]

// Какие переходы агент может делать (без Sergey-апрува)
const AGENT_ALLOWED: Record<string, string[]> = {
  parsed:        ['enriching','trash'],
  enriching:     ['plan_proposed','trash'],
  building:      ['built'],
  selling:       ['sold','lost'],
}

// Какие требуют оператора
const OPERATOR_ONLY = ['approved','for_sale','selling','trash','lost'] // (но selling/lost может и агент-продавец)

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  const agentToken = req.headers.get('x-agent-token')
  const agentName = req.headers.get('x-agent-name') || 'agent:unknown'
  const isAgent = agentToken === process.env.AGENT_WEBHOOK_TOKEN

  if (!session && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { to_status, reason, trash_reason, note } = body as {
    to_status?: string; reason?: string; trash_reason?: string; note?: string
  }
  if (!to_status || !VALID.includes(to_status)) {
    return NextResponse.json({ error: `Invalid to_status. Must be one of: ${VALID.join(', ')}` }, { status: 400 })
  }

  // Объединённое поле для журнала: trash_reason + note + legacy reason
  const journalReason = [trash_reason && `[${trash_reason}]`, note, reason]
    .filter(Boolean).join(' · ') || null

  const sb = admin()
  const { data: lead } = await sb.from('dream_leads').select('id, tenant_id, build_status').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  // Auth check: агент может делать только разрешённые переходы
  if (isAgent && !session) {
    const allowed = AGENT_ALLOWED[lead.build_status] ?? []
    if (!allowed.includes(to_status)) {
      return NextResponse.json({
        error: `Агент не вправе ${lead.build_status} → ${to_status}. Этот переход делает Sergey.`,
      }, { status: 403 })
    }
  }

  // Проверка блокеров для переходов вперёд (не trash/lost)
  const isForward = !['trash', 'lost'].includes(to_status)
  const overrideText = (reason ?? '') + ' ' + (note ?? '')
  const isOverride = overrideText.toLowerCase().includes('override') || overrideText.toLowerCase().includes('всё равно')
  if (isForward && !isOverride) {
    const { data: blockers } = await sb.from('dream_lead_blockers').select('lead_id').eq('lead_id', lead.id)
    if (blockers && blockers.length > 0) {
      return NextResponse.json({
        error: 'На лиде активные блокеры. Закройте их или добавьте reason с "override" чтобы продолжить.',
      }, { status: 409 })
    }
  }

  const actor = session ? session.login : agentName
  const upd: Record<string, any> = { build_status: to_status, updated_at: new Date().toISOString() }
  if (to_status === 'approved') {
    upd.build_approved_at = new Date().toISOString()
    upd.build_approved_by = actor
  }
  // §0.5: при переходе в trash — сохраняем trash_reason на dream_leads
  if (to_status === 'trash' && trash_reason) {
    upd.trash_reason = trash_reason
  }

  const { data, error } = await sb
    .from('dream_leads')
    .update(upd)
    .eq('id', lead.id)
    .select('slug, build_status, trash_reason')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Журнал перехода
  await sb.from('dream_lead_transitions').insert({
    lead_id: lead.id, tenant_id: lead.tenant_id,
    from_status: lead.build_status, to_status, actor, reason: journalReason,
  })

  // §0.5: при trash/lost с note или trash_reason — INSERT в dream_lead_comments
  // (kind='fact' для прозрачности — у Sergey'я в карточке видно почему агент решил)
  if ((to_status === 'trash' || to_status === 'lost') && (note || trash_reason)) {
    await sb.from('dream_lead_comments').insert({
      lead_id: lead.id, tenant_id: lead.tenant_id,
      author: actor, kind: 'fact',
      text: `🤖 ${to_status === 'trash' ? 'TRASH' : 'LOST'}` +
            (trash_reason ? ` [${trash_reason}]` : '') +
            (note ? `\n${note}` : ''),
    })
  }

  return NextResponse.json({ ok: true, lead: data })
}

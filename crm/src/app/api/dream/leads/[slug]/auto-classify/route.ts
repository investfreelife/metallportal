/**
 * Автомат-фильтр мусора (Sergey directive 2026-06-18).
 *
 * POST /api/dream/leads/[slug]/auto-classify
 * Headers: x-agent-token (для агентов) или cookie-session
 *
 * Запускается АГЕНТОМ-ПРОВЕРЩИКОМ перед тем как поставить лида в очередь
 * на утверждение Sergey'я. Если лид «явный мусор» — кладёт в trash с
 * причиной trash_reason='auto:<reason>', и Sergey его НЕ ВИДИТ в обычной
 * воронке (только в колонке «🗑 Мусор» с возможностью «всё равно делать»).
 *
 * Критерии auto:trash (по AGENT_QUICK_START.md §0.5):
 *   - has_website=1 / website_url не пуст → 'has_website'
 *   - city != Москва → 'wrong_city'
 *   - rating < 4.0 ИЛИ reviews_count == 0 ИЛИ photos_count == 0 → 'low_quality'
 *   - Дубль по phone → 'duplicate'
 *   - phone пуст → 'no_phone' (продавать некому)
 *
 * Все trash_reason соответствуют значениям из §0.5 (без 'auto:' префикса)
 * чтобы UI и фильтры показывали одинаковые tags.
 *
 * Sergey может override через CRM (кнопка «↩️ Вернуть из мусора»).
 *
 * Зачем: чтобы Sergey не тратил время на отсев заведомо плохих лидов.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface ClassifyResult {
  is_trash: boolean
  reason: string | null
  details: string[]
}

function classify(lead: any, duplicateOf: number | null): ClassifyResult {
  const details: string[] = []
  let reason: string | null = null

  // 1. У бизнеса уже есть свой сайт (§0.5)
  if ((lead.has_website === 1 && lead.website_url) || (lead.website_url && lead.website_url.trim().length > 0)) {
    reason ??= 'has_website'
    details.push(`Сайт уже есть: ${lead.website_url}`)
  }
  // 2. Нет телефона — продавать некому (§0.5)
  if (!lead.phone || lead.phone.trim().length === 0) {
    reason ??= 'no_phone'
    details.push('Нет телефона')
  }
  // 3. Город не Москва (§0.5)
  if (lead.city && lead.city.toLowerCase().trim() !== 'москва') {
    reason ??= 'wrong_city'
    details.push(`Город: ${lead.city} (не Москва)`)
  }
  // 4. Низкое качество (§0.5): rating<4.0 ИЛИ 0 отзывов ИЛИ 0 фото
  const qualityIssues: string[] = []
  if (lead.rating != null && lead.rating < 4.0) qualityIssues.push(`рейтинг ${lead.rating} < 4.0`)
  if (lead.reviews_count === 0) qualityIssues.push('0 отзывов')
  if (lead.photos_count === 0)  qualityIssues.push('0 фото')
  if (qualityIssues.length > 0) {
    reason ??= 'low_quality'
    details.push(`Низкое качество: ${qualityIssues.join('; ')}`)
  }
  // 5. Дубль (§0.5)
  if (duplicateOf != null) {
    reason ??= 'duplicate'
    details.push(`Дубль лида #${duplicateOf}`)
  }

  return { is_trash: reason !== null, reason, details }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  const agentToken = req.headers.get('x-agent-token')
  if (!session && agentToken !== process.env.AGENT_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const sb = admin()
  const { data: lead } = await sb
    .from('dream_leads')
    .select('id, tenant_id, name, phone, city, has_website, website_url, rating, reviews_count, photos_count, build_status, trash_reason')
    .eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  // Дубль: тот же phone+name И другой лид (НЕ trash)
  let duplicateOf: number | null = null
  if (lead.phone) {
    const { data: dupes } = await sb
      .from('dream_leads')
      .select('id, name, build_status')
      .eq('tenant_id', lead.tenant_id)
      .eq('phone', lead.phone)
      .neq('id', lead.id)
      .neq('build_status', 'trash')
      .limit(1)
    if (dupes && dupes.length > 0) duplicateOf = (dupes[0] as any).id
  }

  const verdict = classify(lead, duplicateOf)

  if (verdict.is_trash) {
    const actor = session ? session.login : (req.headers.get('x-agent-name') || 'agent:classifier')
    // Переводим в trash и пишем причину (по §0.5 — trash_reason без префикса 'auto:')
    await sb.from('dream_leads').update({
      build_status: 'trash',
      trash_reason: verdict.reason,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    await sb.from('dream_lead_transitions').insert({
      lead_id: lead.id, tenant_id: lead.tenant_id,
      from_status: lead.build_status, to_status: 'trash',
      actor,
      reason: `[${verdict.reason}] ` + verdict.details.join('; '),
    })

    // Записываем как комментарий типа 'fact' для прозрачности
    await sb.from('dream_lead_comments').insert({
      lead_id: lead.id, tenant_id: lead.tenant_id,
      author: actor,
      kind: 'fact',
      text: `🤖 Авто-классификация: ${verdict.reason}\n${verdict.details.join('\n')}`,
    })
  }

  return NextResponse.json({ ok: true, ...verdict })
}

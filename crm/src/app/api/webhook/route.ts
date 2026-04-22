import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { analyzeNewLead } from '@/lib/ai'
import { notifyManager } from '@/lib/telegram'
import { logEvent } from '@/lib/logger'

/**
 * Generic webhook endpoint for forms on metallportal.ru
 *
 * POST /api/webhook
 * Headers: x-webhook-secret: WEBHOOK_SECRET (optional but recommended)
 *
 * Body (JSON):
 *   type: 'order' | 'callback' | 'quote' | 'contact_form'
 *   tenant_id: string
 *   name?: string
 *   phone?: string
 *   email?: string
 *   company?: string
 *   message?: string
 *   items?: { name, qty, price }[]   (for orders)
 *   total?: number
 *   utm_source?, utm_campaign?
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Optional secret check
  const secret = process.env.WEBHOOK_SECRET
  if (secret && request.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const {
    type = 'contact_form',
    tenant_id,
    name, phone, email, company,
    message, items, total,
    utm_source, utm_campaign,
  } = body as Record<string, unknown>

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  // ── Find or create contact ───────────────────────────────────────────────
  let contactId: string | null = null
  let isNew = false

  const lookup = phone
    ? supabase.from('contacts').select('id, ai_score, full_name').eq('tenant_id', String(tenant_id)).eq('phone', String(phone)).maybeSingle()
    : email
    ? supabase.from('contacts').select('id, ai_score, full_name').eq('tenant_id', String(tenant_id)).eq('email', String(email)).maybeSingle()
    : { data: null }

  const { data: existing } = await lookup

  if (existing) {
    contactId = existing.id
    const newScore = Math.min(100, (existing.ai_score ?? 0) + 30)
    await supabase.from('contacts').update({
      ai_score: newScore,
      full_name: existing.full_name || name || null,
      company_name: company || null,
      last_contact_at: new Date().toISOString(),
      utm_source: utm_source || null,
      utm_campaign: utm_campaign || null,
    }).eq('id', contactId)
  } else {
    const { data: created } = await supabase.from('contacts').insert({
      tenant_id,
      full_name: name || null,
      phone: phone || null,
      email: email || null,
      company_name: company || null,
      status: 'new',
      type: 'lead',
      ai_score: 30,
      source: 'website',
      utm_source: utm_source || null,
      utm_campaign: utm_campaign || null,
      last_contact_at: new Date().toISOString(),
    }).select('id').single()

    if (created) {
      contactId = created.id
      isNew = true
    }
  }

  // ── Create activity record ────────────────────────────────────────────────
  if (contactId) {
    const activityTitle =
      type === 'order' ? `Заказ на сайте${total ? ' — ' + Number(total).toLocaleString('ru') + ' ₽' : ''}` :
      type === 'callback' ? 'Запрос обратного звонка' :
      type === 'quote' ? 'Запрос коммерческого предложения' :
      'Обращение через форму'

    await supabase.from('activities').insert({
      tenant_id,
      contact_id: contactId,
      type: 'note',
      direction: 'inbound',
      subject: activityTitle,
      body: message ? String(message) : null,
    })
  }

  // ── Add to AI queue for ALL form submissions ─────────────────────────────
  if (contactId) {
    const priority = type === 'order' ? 'high' : 'normal'
    const actionType = type === 'order' ? 'make_call' : 'send_proposal'

    const reasoning =
      type === 'order'
        ? `Новый заказ с сайта на сумму ${total ? Number(total).toLocaleString('ru') + ' ₽' : 'неизвестно'}. Клиент: ${name || phone || email}. Источник: ${utm_source || 'прямой'}.`
        : `Новое обращение через форму "${type}". Клиент: ${name || phone || email}. Источник: ${utm_source || 'прямой'}.`

    const suggested =
      type === 'order'
        ? `Добрый день${name ? ', ' + name : ''}! Ваш заказ получен. Перезвоню в течение 15 минут для подтверждения.`
        : `Добрый день${name ? ', ' + name : ''}! Получил вашу заявку. Свяжусь с вами в ближайшее время.`

    const clientMsg = message ? String(message).slice(0, 500) : null
    const fullReasoning = reasoning + (clientMsg ? `\n\n💬 Сообщение клиента: «${clientMsg}»` : '')

    const { data: queueItem, error: queueError } = await supabase.from('ai_queue').insert({
      tenant_id,
      contact_id: contactId,
      action_type: actionType,
      priority,
      status: 'pending',
      ai_reasoning: fullReasoning,
      content: suggested,
      suggested_message: suggested,
    }).select('id').single()

    if (queueError) {
      console.error('[webhook] ai_queue insert error:', queueError.message)
    }

    // ── Авто-создание сделки (не блокируем если таблица отличается) ──────────
    void supabase.from('deals').insert({
      tenant_id,
      contact_id: contactId,
      title: `${type === 'order' ? 'Заказ' : 'Лид'}: ${String(name || phone || email || 'Новый')}`,
      amount: total ? Number(total) : null,
      stage: 'new',
    })

    // ── Немедленное уведомление менеджера (до AI, без задержки) ──────────────
    if (queueItem) {
      const queueId = queueItem.id

      const notified = await notifyManager({
        queue_id: queueId,
        contact_name: name ? String(name) : null,
        contact_phone: phone ? String(phone) : null,
        action_type: actionType,
        priority,
        ai_reasoning: reasoning + (clientMsg ? `\n\n💬 Сообщение: «${clientMsg}»` : ''),
        suggested_message: suggested,
      })
      await logEvent('tg_notify_manager', { queueId, notified, contact: name || phone }, notified ? 'ok' : 'failed', notified ? undefined : 'CRM_MANAGER_TG_ID или TELEGRAM_BOT_TOKEN не найден')

      // Async: AI улучшает текст и присваивает сегмент
      ;(async () => {
        const ai = await analyzeNewLead({
          name: name ? String(name) : null,
          phone: phone ? String(phone) : null,
          email: email ? String(email) : null,
          company: company ? String(company) : null,
          form_type: String(type),
          message: clientMsg,
          items: Array.isArray(items) ? items : undefined,
          total: total ? Number(total) : null,
          utm_source: utm_source ? String(utm_source) : null,
          utm_campaign: utm_campaign ? String(utm_campaign) : null,
        })

        if (ai) {
          const mappedPriority = ai.priority === 'medium' ? 'normal' : ai.priority
          const mappedAction = ai.action_type === 'call' ? 'make_call' : ai.action_type === 'schedule' ? 'create_task' : ai.action_type
          const quoteBlock = ai.quote_text ? `\n\n📋 КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ:\n${ai.quote_text}` : ''
          await supabase.from('ai_queue').update({
            ai_reasoning: ai.reasoning + (clientMsg ? `\n\n💬 Сообщение клиента: «${clientMsg}»` : ''),
            content: (ai.suggested_message || suggested) + quoteBlock,
            suggested_message: (ai.suggested_message || suggested) + quoteBlock,
            priority: mappedPriority,
            action_type: mappedAction,
          }).eq('id', queueId)

          if (contactId) {
            await supabase.from('contacts').update({
              ai_segment: ai.segment,
              ai_score: Math.min(100, Math.max(0, 30 + ai.score_adjustment)),
              ai_next_action: ai.next_action_hint,
            }).eq('id', contactId)
          }
        }
      })().catch((e) => console.error('[webhook] AI analysis error:', e))
    }
  }

  // ── Log as site event ─────────────────────────────────────────────────────
  await supabase.from('site_events').insert({
    tenant_id,
    contact_id: contactId,
    event_type: `webhook_${type}`,
    event_data: { name, phone, email, company, message, items, total },
    utm_source: utm_source || null,
    utm_campaign: utm_campaign || null,
  })

  await logEvent('webhook_received', { type, name, phone, email, isNew, contactId })
  return NextResponse.json({ ok: true, contact_id: contactId, is_new: isNew })
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const SCORE_MAP: Record<string, number> = {
  form_submit:      30,
  add_to_cart:      25,
  product_view_long: 20,
  file_download:    15,
  phone_click:      15,
  contacts_page:    10,
  page_view:         2,
  page_leave:        0,
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()

  let body: Record<string, unknown>
  try {
    const text = await request.text()
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers: CORS })
  }

  const {
    tenant_id, visitor_id, session_id, type,
    url, referrer, utm_source, utm_campaign, utm_medium,
    device, time_spent, scroll_depth, ts,
    phone, email, file, product_id, cart_value,
    // webhook fields
    contact_name, contact_phone, contact_email, contact_company,
  } = body as Record<string, string | number | null>

  if (!tenant_id || !type) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400, headers: CORS })
  }

  // ── Determine extra score for this event ────────────────────────────────
  let scoreBonus = SCORE_MAP[String(type)] ?? 0

  // Long product view bonus
  if (type === 'page_leave' && typeof time_spent === 'number' && time_spent > 120) {
    scoreBonus = SCORE_MAP['product_view_long']
  }

  // ── Find or create contact by phone/email (webhook path) ─────────────────
  let contactId: string | null = null

  if (contact_phone || contact_email) {
    const lookup = contact_phone
      ? supabase.from('contacts').select('id, ai_score').eq('tenant_id', String(tenant_id)).eq('phone', String(contact_phone)).maybeSingle()
      : supabase.from('contacts').select('id, ai_score').eq('tenant_id', String(tenant_id)).eq('email', String(contact_email)).maybeSingle()

    const { data: existing } = await lookup

    if (existing) {
      contactId = existing.id
      // Update score
      const newScore = Math.min(100, (existing.ai_score ?? 0) + scoreBonus)
      await supabase.from('contacts').update({
        ai_score: newScore,
        last_contact_at: new Date().toISOString(),
        utm_source: utm_source || undefined,
        utm_campaign: utm_campaign || undefined,
      }).eq('id', contactId)
    } else {
      // Create new contact
      const { data: created } = await supabase.from('contacts').insert({
        tenant_id,
        full_name: contact_name || null,
        phone: contact_phone || null,
        email: contact_email || null,
        company_name: contact_company || null,
        status: 'new',
        ai_segment: 'unknown',
        ai_score: Math.min(100, scoreBonus),
        source: 'website',
        utm_source: utm_source || null,
        utm_campaign: utm_campaign || null,
        last_contact_at: new Date().toISOString(),
      }).select('id').single()

      if (created) {
        contactId = created.id

        // Create AI queue item for new lead
        if (type === 'form_submit' || type === 'webhook_order') {
          const msg = `Добрый день${contact_name ? ', ' + contact_name : ''}! Спасибо за обращение. Подготовлю предложение и свяжусь с вами в ближайшее время.`
          try {
            await supabase.from('ai_queue').insert({
              tenant_id,
              contact_id: contactId,
              action_type: 'send_proposal',
              priority: 'high',
              status: 'pending',
              ai_reasoning: `Новый лид с сайта. Источник: ${utm_source || 'прямой'}. Тип обращения: ${type}.`,
              content: msg,
              suggested_message: msg,
            })
          } catch { /* migration may not be run yet */ }
        }
      }
    }
  }

  // ── Store event in site_events ────────────────────────────────────────────
  await supabase.from('site_events').insert({
    tenant_id,
    visitor_id: visitor_id || null,
    session_id: session_id || null,
    contact_id: contactId,
    event_type: String(type),
    event_data: {
      time_spent, scroll_depth, phone, email, file,
      product_id, cart_value, ts,
    },
    url: url || null,
    referrer: referrer || null,
    utm_source: utm_source || null,
    utm_campaign: utm_campaign || null,
    device: device || null,
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}

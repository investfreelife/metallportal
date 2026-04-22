import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, items, comment } = await req.json();
    if (!name || !phone || !items?.length) {
      return NextResponse.json({ error: "Заполните имя, телефон и добавьте товары" }, { status: 400 });
    }

    const supabase = getSupabase()

    // Use item.total for reliable sum (already computed in cart)
    const total: number = Array.isArray(items)
      ? items.reduce((sum: number, i: { total?: number; price?: number; qty?: number }) =>
          sum + (i.total ?? (i.price || 0) * (i.qty || 1)), 0)
      : 0

    // 1. Save order — try full schema first, fallback to basic columns
    const basePayload: Record<string, unknown> = {
      customer_name: name,
      customer_phone: phone,
      status: "new",
      created_at: new Date().toISOString(),
    }
    if (email) basePayload.customer_email = email
    if (comment) basePayload.comment = comment

    let orderId: string | null = null

    // Try with extended columns (items, total_amount) — needs supabase-orders-fix.sql
    const { data: orderFull, error: fullError } = await supabase.from("orders")
      .insert({ ...basePayload, items, total_amount: Math.round(total) })
      .select("id").single()

    if (!fullError) {
      orderId = orderFull?.id
    } else {
      // Fallback: insert without extended columns
      const { data: orderBasic, error: basicError } = await supabase.from("orders")
        .insert(basePayload)
        .select("id").single()
      if (basicError) {
        console.error("Order insert error:", basicError)
        return NextResponse.json({ error: basicError.message }, { status: 500 })
      }
      orderId = orderBasic?.id
    }

    // 2. Find or create contact
    let contactId: string | null = null

    const { data: existing } = await supabase.from('contacts')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('phone', phone)
      .maybeSingle()

    if (existing) {
      contactId = existing.id
      await supabase.from('contacts').update({
        full_name: name,
        email: email || null,
        last_contact_at: new Date().toISOString(),
      }).eq('id', contactId)
    } else {
      const { data: created } = await supabase.from('contacts').insert({
        tenant_id: TENANT_ID,
        full_name: name,
        phone,
        email: email || null,
        status: 'new',
        type: 'lead',
        source: 'website',
        ai_score: 30,
        last_contact_at: new Date().toISOString(),
      }).select('id').single()
      if (created) contactId = created.id
    }

    // 3. Create deal with items directly in Supabase (reliable, no fire-and-forget)
    if (contactId) {
      const dealTitle = `Заказ: ${name}${total ? ' — ' + Math.round(total).toLocaleString('ru') + ' ₽' : ''}`

      const dealBase = {
        tenant_id: TENANT_ID,
        contact_id: contactId,
        title: dealTitle,
        amount: Math.round(total) || null,
        stage: 'new',
        ai_win_probability: 0,
      }

      // Try with items + currency columns, fallback to base if columns don't exist yet
      const { error: dealErr1 } = await supabase.from('deals')
        .insert({ ...dealBase, items, currency: 'RUB' })
      if (dealErr1) {
        console.error('[orders] deal insert (full):', dealErr1.message)
        const { error: dealErr2 } = await supabase.from('deals').insert(dealBase)
        if (dealErr2) console.error('[orders] deal insert (base):', dealErr2.message)
      }

      // 4. Activity log
      try {
        await supabase.from('activities').insert({
          tenant_id: TENANT_ID,
          contact_id: contactId,
          type: 'note',
          direction: 'inbound',
          subject: `Заказ на сайте${total ? ' — ' + Math.round(total).toLocaleString('ru') + ' ₽' : ''}`,
          body: comment || null,
        })
      } catch { /* non-critical */ }
    }

    // 5. Notify CRM async (Telegram + AI) — wrap in try so it doesn't block
    try {
      await Promise.race([
        fetch('https://metallportal-crm2.vercel.app/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order',
            tenant_id: TENANT_ID,
            name, phone,
            email: email || null,
            message: comment || null,
            items,
            total: Math.round(total),
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])
    } catch { /* Telegram notify / AI analysis timeout is non-critical */ }

    return NextResponse.json({ ok: true, orderId });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, buildProposalEmail, buildOrderConfirmEmail } from '@/lib/email'

/**
 * POST /api/email/send
 * Body: { queue_item_id?, to, template?, subject?, html?, contact_id?, name?, company?, message?, items?, total? }
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const body = await request.json()
  const { to, template, subject, html, queue_item_id, contact_id,
          name, company, message, items, total } = body

  if (!to) {
    return NextResponse.json({ error: 'to is required' }, { status: 400 })
  }

  let emailHtml = html
  let emailSubject = subject

  if (template === 'proposal') {
    emailHtml = buildProposalEmail({ name, company, message })
    emailSubject = subject || `Ваша заявка принята — МеталлПортал`
  } else if (template === 'order_confirm') {
    emailHtml = buildOrderConfirmEmail({ name, items, total })
    emailSubject = subject || `Заказ оформлен — МеталлПортал`
  }

  if (!emailHtml || !emailSubject) {
    return NextResponse.json({ error: 'subject and html (or template) required' }, { status: 400 })
  }

  const result = await sendEmail({ to, subject: emailSubject, html: emailHtml })

  // Log activity if contact_id provided
  if (contact_id) {
    await supabase.from('activities').insert({
      contact_id,
      type: 'email',
      title: `Email: ${emailSubject}`,
      notes: `Отправлено на ${to}`,
    })
  }

  // Mark queue item as executed
  if (queue_item_id && result.ok) {
    await supabase.from('ai_queue').update({ status: 'executed' }).eq('id', queue_item_id)
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

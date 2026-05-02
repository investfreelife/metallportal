import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSession(_req)
  if (!auth.ok) return auth.error

  const { id: dealId } = await params
  const supabase = getSupabase()

  const { data: deal } = await supabase.from('deals')
    .select('title, amount, items, contact:contacts(full_name, phone, telegram_chat_id, email)')
    .eq('id', dealId)
    .single()

  if (!deal) return NextResponse.json({ error: 'deal not found' }, { status: 404 })

  const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
  const items: Array<{ name: string; qty: number; unit: string; total?: number }> = deal.items ?? []

  const itemLines = items.map((it) =>
    `• ${it.name} — ${it.qty} ${it.unit}${it.total ? ' (' + it.total.toLocaleString('ru') + ' ₽)' : ''}`
  ).join('\n')

  const totalStr = deal.amount ? deal.amount.toLocaleString('ru') + ' ₽' : 'уточняется'

  const message = `✅ Ваш заказ получен!\n\nМы обрабатываем вашу заявку и свяжемся с вами в ближайшее время.\n\n${itemLines ? '*Состав заказа:*\n' + itemLines + '\n\n' : ''}💰 Итого: ${totalStr}\n\nСпасибо за обращение в МеталлПортал! 🏗`

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  let sent = false

  if (botToken && contact?.telegram_chat_id) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: contact.telegram_chat_id,
          text: message,
          parse_mode: 'Markdown',
        }),
      })
      if (tgRes.ok) sent = true
    } catch { /* ignore */ }
  }

  // Mark deal as customer_notified
  await supabase.from('deals').update({ customer_notified: true }).eq('id', dealId)

  // Log activity
  try {
    await supabase.from('activities').insert({
      tenant_id: 'a1000000-0000-0000-0000-000000000001',
      contact_id: contact?.id ?? null,
      type: 'note',
      direction: 'outbound',
      subject: 'Уведомление клиента об получении заказа',
      body: sent ? 'Отправлено в Telegram' : 'Telegram не подключён у клиента',
    })
  } catch { /* ignore */ }

  return NextResponse.json({
    ok: true,
    sent,
    message: sent
      ? 'Уведомление отправлено клиенту в Telegram'
      : 'Клиент не имеет Telegram — свяжитесь по телефону: ' + (contact?.phone ?? '—'),
  })
}

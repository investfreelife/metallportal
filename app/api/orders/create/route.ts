import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const { items, total_price, contact, source } = await req.json()

  // 1. Создать/найти контакт в CRM
  let contactId: string | null = null
  if (contact.phone || contact.email) {
    const query = contact.phone
      ? supabase.from('contacts').select('id').eq('tenant_id', TENANT_ID).eq('phone', contact.phone)
      : supabase.from('contacts').select('id').eq('tenant_id', TENANT_ID).eq('email', contact.email)

    const { data: existing } = await query.single()

    if (existing) {
      contactId = existing.id
    } else {
      const { data: newContact } = await supabase.from('contacts').insert({
        tenant_id: TENANT_ID,
        full_name: contact.name || 'Клиент с сайта',
        phone: contact.phone,
        email: contact.email,
        source: source || 'ai_search',
        ai_score: 65,
        ai_segment: 'hot',
      }).select('id').single()
      contactId = newContact?.id ?? null
    }
  }

  // 2. Создать сделку в CRM
  const itemsList = items
    .map((i: { name: string; quantity: number; unit: string }) => `${i.name} ${i.quantity} ${i.unit}`)
    .join(', ')

  const { data: deal } = await supabase.from('deals').insert({
    tenant_id: TENANT_ID,
    contact_id: contactId,
    title: `Заявка с сайта: ${itemsList.substring(0, 80)}`,
    amount: total_price,
    stage: 'new',
    ai_win_probability: 70,
  }).select('id').single()

  // 3. Создать задачу в AI очереди — запустить продавца
  const itemsText = items
    .map((i: { name: string; quantity: number; unit: string; total_price: number }) =>
      `• ${i.name} ${i.quantity} ${i.unit} = ${i.total_price.toLocaleString('ru-RU')} ₽`
    )
    .join('\n')

  await supabase.from('ai_queue').insert({
    tenant_id: TENANT_ID,
    contact_id: contactId,
    deal_id: deal?.id,
    action_type: 'send_proposal',
    priority: 'urgent',
    subject: `🔥 Новая заявка с AI поиска: ${itemsList.substring(0, 60)}`,
    content: `Клиент: ${contact.name || 'Неизвестен'}
Телефон: ${contact.phone || '—'}
Email: ${contact.email || '—'}

Позиции:
${itemsText}

Итого: ${total_price.toLocaleString('ru-RU')} ₽${contact.comment ? `\n\nКомментарий: ${contact.comment}` : ''}`,
    ai_reasoning: 'Клиент оформил заявку через AI поиск на сайте. Горячий лид — связаться в течение 15 минут.',
    status: 'pending',
  })

  // 4. Уведомить менеджера в Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID
  if (botToken && chatId) {
    const msg = `🔥 *Новая заявка с сайта!*\n\n${itemsList}\n\n💰 *${total_price.toLocaleString('ru-RU')} ₽*\n📞 ${contact.phone || contact.email || 'нет контакта'}\n👤 ${contact.name || '—'}`
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
    })
  }

  // 5. Запустить AI продавца через harlan-ai (фоново, не блокируем ответ)
  const aiUrl = process.env.NEXT_PUBLIC_AI_URL
  const aiKey = process.env.AI_API_KEY
  if (aiUrl && aiKey && contactId) {
    fetch(`${aiUrl}/api/agents/sales/process-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': aiKey },
      body: JSON.stringify({
        contact_id: contactId,
        full_name: contact.name,
        phone: contact.phone,
        email: contact.email,
        message: itemsList,
        source: 'ai_search',
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, deal_id: deal?.id })
}

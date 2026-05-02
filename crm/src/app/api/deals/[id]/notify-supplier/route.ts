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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { id: dealId } = await params
  const { supplierId } = await req.json()

  const supabase = getSupabase()

  // Get deal with items and suppliers
  const { data: deal } = await supabase.from('deals')
    .select('title, items, suppliers, contact:contacts(full_name, phone)')
    .eq('id', dealId)
    .single()

  if (!deal) return NextResponse.json({ error: 'deal not found' }, { status: 404 })

  const suppliers: Array<{ id: string; name: string; phone?: string; telegram?: string; email?: string }> = deal.suppliers ?? []
  const supplier = suppliers.find((s) => s.id === supplierId)
  if (!supplier) return NextResponse.json({ error: 'supplier not found' }, { status: 404 })

  const items: Array<{ name: string; qty: number; unit: string }> = deal.items ?? []

  // Build message
  const itemLines = items.map((it: { name: string; qty: number; unit: string }) =>
    `• ${it.name} — ${it.qty} ${it.unit}`
  ).join('\n')

  const message = `📦 *Запрос цен на металлопрокат*\n\nЗаказ: ${deal.title}\n\n${itemLines}\n\nПожалуйста, пришлите ваши цены.`

  // Try to send via Telegram bot if supplier has telegram username/chat_id
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  let sent = false

  if (botToken && supplier.telegram) {
    try {
      // If telegram is a chat_id (numeric) or @username, try to send
      const chatId = supplier.telegram.startsWith('@') ? supplier.telegram : supplier.telegram
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      })
      if (tgRes.ok) sent = true
    } catch { /* ignore */ }
  }

  // Log to activities
  try {
    await supabase.from('activities').insert({
      tenant_id: 'a1000000-0000-0000-0000-000000000001',
      type: 'note',
      direction: 'outbound',
      subject: `Запрос цен отправлен поставщику: ${supplier.name}`,
      body: itemLines,
    })
  } catch { /* ignore */ }

  return NextResponse.json({
    ok: true,
    sent,
    message: sent ? `Запрос отправлен в Telegram поставщику ${supplier.name}` : `Запрос зафиксирован. Telegram не настроен — свяжитесь вручную: ${supplier.phone ?? '—'}`,
  })
}

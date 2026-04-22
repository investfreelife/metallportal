import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const supabase = getSupabase()
  const { data: contact } = await supabase
    .from('contacts')
    .select('full_name, company_name, telegram, telegram_chat_id')
    .eq('id', id)
    .single()

  if (!contact) return NextResponse.json({ error: 'contact not found' }, { status: 404 })

  const chatId = contact.telegram_chat_id || contact.telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) return NextResponse.json({ ok: false, message: 'Telegram Bot Token не настроен в переменных окружения' })
  if (!chatId) return NextResponse.json({ ok: false, message: 'У контакта не указан telegram_chat_id или @username' })

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
  })
  const tgData = await tgRes.json()

  if (!tgData.ok) {
    return NextResponse.json({ ok: false, message: `Ошибка Telegram: ${tgData.description ?? 'неизвестная ошибка'}` })
  }

  // Log to activities
  await supabase.from('activities').insert({
    tenant_id: 'a1000000-0000-0000-0000-000000000001',
    contact_id: id,
    type: 'message',
    direction: 'outbound',
    subject: 'Telegram сообщение менеджера',
    body: message,
  })

  return NextResponse.json({ ok: true, message: `Сообщение отправлено в Telegram ${chatId}` })
}

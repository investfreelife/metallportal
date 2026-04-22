import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const digits = String(phone).replace(/\D/g, '')
  const normalized = digits.length === 11 ? '+' + digits
    : digits.length === 10 ? '+7' + digits
    : '+' + digits

  const supabase = getSupabase()

  // Find contact by phone
  const { data: contact } = await supabase.from('contacts')
    .select('id, full_name, telegram_chat_id')
    .eq('tenant_id', TENANT_ID)
    .eq('phone', normalized)
    .maybeSingle()

  if (!contact) {
    return NextResponse.json({
      error: 'Номер не найден. Сначала оставьте заявку на сайте.',
    }, { status: 404 })
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

  await supabase.from('contacts').update({
    login_otp: otp,
    login_otp_expires_at: expires,
  }).eq('id', contact.id)

  // Send OTP via Telegram if connected
  if (contact.telegram_chat_id && BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: contact.telegram_chat_id,
        text: `🔑 <b>Код для входа в личный кабинет МеталлПортал:</b>\n\n<code>${otp}</code>\n\nКод действует 10 минут. Никому не сообщайте!`,
        parse_mode: 'HTML',
      }),
    }).catch(() => {})
    return NextResponse.json({ ok: true, method: 'telegram', name: contact.full_name })
  }

  // No Telegram — return code in response (dev mode) or ask to connect bot
  return NextResponse.json({
    error: 'Telegram не подключён. Напишите боту @metallportal_bot и поделитесь номером телефона.',
  }, { status: 400 })
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'

const CRM_URL = 'https://metallportal-crm2.vercel.app'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase() +
         Math.random().toString(36).slice(2, 10).toUpperCase()
}

async function sendTelegramMessage(chatId: string, text: string, token: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const {
    name,
    login,
    role = 'manager',
    telegram_username,
    telegram_chat_id,
    send_telegram = true,
  } = await req.json()

  if (!name || !login) return NextResponse.json({ error: 'Нужны имя и логин' }, { status: 400 })

  // Generate temp password + invite token
  const tempPassword = Math.random().toString(36).slice(2, 10)
  const inviteToken = randomToken()
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const joinLink = `${CRM_URL}/join?token=${inviteToken}`

  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('login', login.trim().toLowerCase())
    .single()
  if (existing) return NextResponse.json({ error: 'Логин уже занят' }, { status: 400 })

  const { data: user, error } = await supabase.from('admin_users').insert({
    name: name.trim(),
    login: login.trim().toLowerCase(),
    password: tempPassword,
    role,
    is_active: true,
    status: 'invited',
    telegram_username: telegram_username?.replace('@', '') || null,
    telegram_chat_id: telegram_chat_id || null,
    invite_token: inviteToken,
    invite_expires_at: inviteExpires,
  }).select('id, name, login').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let tgSent = false
  const tgToken = await getSetting('TELEGRAM_BOT_TOKEN')

  // Try sending via Telegram if we have chat_id
  if (send_telegram && tgToken && telegram_chat_id) {
    const msg = `👋 Вас пригласили в CRM МеталлПортал!\n\n` +
      `📋 <b>Ваши данные:</b>\n` +
      `• Логин: <code>${login.trim().toLowerCase()}</code>\n` +
      `• Пароль: <code>${tempPassword}</code>\n\n` +
      `🔐 Для активации аккаунта перейдите по ссылке:\n${joinLink}\n\n` +
      `(ссылка действительна 7 дней)`
    await sendTelegramMessage(telegram_chat_id, msg, tgToken)
    tgSent = true
  }

  return NextResponse.json({
    ok: true,
    user,
    invite: {
      token: inviteToken,
      link: joinLink,
      login: login.trim().toLowerCase(),
      tempPassword,
      tgSent,
    },
  })
}

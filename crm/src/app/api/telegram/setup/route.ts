/**
 * POST /api/telegram/setup
 * Registers the CRM bot webhook with Telegram + sends a test message to manager
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
import { requireRole } from '@/lib/apiAuth'

const WEBHOOK_URL = 'https://metallportal.vercel.app/api/telegram/webhook'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin'])
  if (!auth.ok) return auth.error

  const token = await getSetting('TELEGRAM_BOT_TOKEN')
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN не задан. Сначала сохраните токен бота.' }, { status: 400 })

  // 1. Register webhook
  const whRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  })
  const whData = await whRes.json()
  if (!whData.ok) {
    return NextResponse.json({ error: `Telegram: ${whData.description}` }, { status: 400 })
  }

  // 2. Get bot info
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const meData = await meRes.json()
  const botName = meData.result?.first_name ?? 'Bot'
  const botUsername = meData.result?.username ?? ''

  // 3. Send test message to manager
  const managerTgId = await getSetting('CRM_MANAGER_TG_ID')
  let testSent = false
  if (managerTgId) {
    const testRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: managerTgId,
        text: `✅ <b>CRM МеталлПортал подключён!</b>\n\n🤖 Бот @${botUsername} активен\n📡 Webhook зарегистрирован\n\nТеперь вы будете получать уведомления о новых лидах с кнопками одобрения.\n\nКоманды:\n/status — статус очереди\n/queue — список задач`,
        parse_mode: 'HTML',
      }),
    })
    const testData = await testRes.json()
    testSent = testData.ok
  }

  return NextResponse.json({
    ok: true,
    webhook_url: WEBHOOK_URL,
    bot: { name: botName, username: botUsername },
    test_sent: testSent,
    manager_notified: Boolean(managerTgId && testSent),
  })
}

export async function DELETE(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin'])
  if (!auth.ok) return auth.error

  const token = await getSetting('TELEGRAM_BOT_TOKEN')
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })

  const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: true }),
  })
  const data = await res.json()
  return NextResponse.json({ ok: data.ok })
}

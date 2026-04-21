/**
 * GET /api/telegram/status
 * Returns current bot connection status
 */
import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'

export async function GET() {
  const token = await getSetting('TELEGRAM_BOT_TOKEN')
  if (!token) return NextResponse.json({ connected: false, reason: 'no_token' })

  try {
    // Check bot identity
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const meData = await meRes.json()
    if (!meData.ok) return NextResponse.json({ connected: false, reason: 'invalid_token' })

    // Check webhook
    const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const whData = await whRes.json()
    const webhookUrl: string = whData.result?.url ?? ''
    const isOurWebhook = webhookUrl.includes('metallportal-crm2.vercel.app/api/telegram/bot')
    const pendingCount: number = whData.result?.pending_update_count ?? 0
    const lastError: string = whData.result?.last_error_message ?? ''

    return NextResponse.json({
      connected: isOurWebhook,
      bot: {
        id: meData.result.id,
        name: meData.result.first_name,
        username: meData.result.username,
        can_join_groups: meData.result.can_join_groups,
      },
      webhook: {
        url: webhookUrl,
        is_our: isOurWebhook,
        pending_updates: pendingCount,
        last_error: lastError,
      },
      manager_id: await getSetting('CRM_MANAGER_TG_ID'),
    })
  } catch {
    return NextResponse.json({ connected: false, reason: 'error' })
  }
}

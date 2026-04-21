/**
 * POST /api/telegram/link
 * Generates a one-time deep-link for the manager to connect their Telegram
 * Manager opens t.me/BOT?start=manager_TOKEN → bot saves their chat_id
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
import crypto from 'crypto'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function POST() {
  const token = await getSetting('TELEGRAM_BOT_TOKEN')
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN не задан' }, { status: 400 })

  // Get bot username
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const meData = await meRes.json()
  if (!meData.ok) return NextResponse.json({ error: 'Неверный токен бота' }, { status: 400 })
  const botUsername = meData.result.username

  // Generate one-time link token (valid 10 min)
  const linkToken = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // Store in DB
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await supabase.from('tenant_settings').upsert(
    { tenant_id: TENANT_ID, key: '_manager_link_token', value: `${linkToken}|${expiresAt}`, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,key' }
  )

  return NextResponse.json({
    ok: true,
    bot_username: botUsername,
    link: `https://t.me/${botUsername}?start=manager_${linkToken}`,
    expires_in: 600,
  })
}

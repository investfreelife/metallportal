import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiAuth'
import { createClient } from '@/lib/supabase/server'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req)
  if (!auth.ok) return auth.error

  const { id } = await params
  const supabase = await createClient()

  const { data: channel } = await supabase.from('channels').select('*').eq('id', id).single()
  if (!channel) return NextResponse.json({ error: 'Канал не найден' }, { status: 404 })

  let success = false
  let message = ''

  try {
    switch (channel.type) {
      case 'telegram_channel': {
        const token = channel.config?.bot_token
        if (!token) { message = 'Введите Bot Token в настройках'; break }
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
        const data = await res.json()
        success = data.ok
        message = success ? `Бот @${data.result.username} подключён ✓` : 'Неверный токен'
        break
      }
      case 'tracking': {
        const { count } = await supabase
          .from('site_events')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', TENANT_ID)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        success = (count || 0) > 0
        message = success
          ? `Работает — ${count} событий за 24 часа ✓`
          : 'Нет событий. Добавьте track.js на сайт.'
        break
      }
      case 'vk_community': {
        const token = channel.config?.access_token
        if (!token) { message = 'Введите Access Token'; break }
        const res = await fetch(`https://api.vk.com/method/account.getInfo?access_token=${token}&v=5.131`)
        const data = await res.json()
        success = !data.error
        message = success ? 'VK API подключён ✓' : (data.error?.error_msg || 'Ошибка токена')
        break
      }
      default:
        message = 'Тест недоступен — проверьте настройки вручную'
        success = false
    }
  } catch (e: any) {
    message = e.message || 'Ошибка подключения'
  }

  await supabase.from('channels').update({
    status: success ? 'active' : 'error',
    error_message: success ? null : message,
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ success, message })
}

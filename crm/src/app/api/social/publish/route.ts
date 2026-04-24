import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { post_id } = await req.json()
  const supabase = await createClient()

  const { data: post } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: settings } = await supabase.from('settings').select('key, value').in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL_ID'])
  const botToken = settings?.find((s: { key: string; value: string }) => s.key === 'TELEGRAM_BOT_TOKEN')?.value || process.env.TELEGRAM_BOT_TOKEN
  const channelId = settings?.find((s: { key: string; value: string }) => s.key === 'TELEGRAM_CHANNEL_ID')?.value || process.env.TELEGRAM_CHANNEL_ID

  if (!botToken || !channelId) {
    return NextResponse.json({ error: 'Telegram не настроен. Добавьте BOT_TOKEN и CHANNEL_ID в настройках.' }, { status: 400 })
  }

  const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: post.content,
      parse_mode: 'HTML',
    })
  })

  const tgData = await tgResponse.json()

  if (tgData.ok) {
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      platform_post_id: String(tgData.result.message_id),
    }).eq('id', post_id)

    await supabase.from('activities').insert({
      tenant_id: post.tenant_id,
      type: 'ai_action',
      subject: 'Пост опубликован в Telegram',
      body: post.content.substring(0, 200),
      is_ai_generated: true,
    })

    return NextResponse.json({ success: true, message_id: tgData.result.message_id })
  }

  await supabase.from('social_posts').update({ status: 'failed' }).eq('id', post_id)
  return NextResponse.json({ error: tgData.description }, { status: 500 })
}

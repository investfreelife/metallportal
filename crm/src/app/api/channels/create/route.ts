import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

const CHANNEL_NAMES: Record<string, string> = {
  yandex_direct: 'Яндекс.Директ',
  yandex_rsy: 'Яндекс РСЯ',
  vk_ads: 'VK Реклама',
  vk_community: 'VK Сообщество',
  telegram_channel: 'Telegram канал',
  telegram_ads: 'Telegram Ads',
  google_ads: 'Google Ads',
  email: 'Email рассылки',
  whatsapp: 'WhatsApp',
  tracking: 'Трекинг сайта',
  referral: 'Реферальная программа',
  youtube: 'YouTube',
  dzen: 'Яндекс Дзен',
  tenders: 'Тендеры',
  sms: 'SMS',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channels')
    .insert({
      tenant_id: TENANT_ID,
      type: body.type,
      name: body.name || CHANNEL_NAMES[body.type] || body.type,
      status: 'inactive',
      config: {},
      stats: {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channel: data })
}

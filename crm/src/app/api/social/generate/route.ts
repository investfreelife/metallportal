import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

const POST_TYPES = [
  { type: 'price_update', prompt: 'Напиши пост об обновлении цен на металлопрокат. Упомяни что цены актуальны и можно запросить КП.' },
  { type: 'product_focus', prompt: 'Напиши экспертный пост об одном виде металлопроката (труба, арматура, балка, лист). Технические характеристики, применение, советы.' },
  { type: 'case_study', prompt: 'Напиши кейс: строительная компания заказала металл, получила быстро и качественно. Конкретные цифры и детали.' },
  { type: 'gost_tip', prompt: 'Напиши полезный пост о стандартах ГОСТ для металлопроката. Что означает, как выбрать правильный стандарт.' },
  { type: 'market_review', prompt: 'Напиши короткий обзор рынка металлопроката: тренды, цены, спрос. Экспертный тон.' },
]

export async function POST(req: NextRequest) {
  const { platform, post_type } = await req.json()
  const type = POST_TYPES.find(t => t.type === post_type) || POST_TYPES[Math.floor(Math.random() * POST_TYPES.length)]

  const supabase = await createClient()
  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'OPENROUTER_API_KEY').single()
  const apiKey = settings?.value || process.env.OPENROUTER_API_KEY

  const systemPrompt = `Ты SMM-менеджер металлоторговой компании МеталлПортал.
Пиши посты для ${platform === 'telegram' ? 'Telegram канала' : 'ВКонтакте сообщества'}.
Стиль: профессиональный но живой, без канцелярита.
Добавляй 2-3 релевантных emoji.
Для Telegram: используй форматирование (жирный, курсив).
Длина: 150-300 символов для TG, 300-500 для VK.
В конце добавь призыв к действию: написать в ЛС или оставить заявку.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: type.prompt },
      ],
      max_tokens: 500,
    })
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  const { data: post } = await supabase.from('social_posts').insert({
    tenant_id: TENANT_ID,
    platform,
    status: 'draft',
    content,
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select().single()

  return NextResponse.json({ post, content })
}

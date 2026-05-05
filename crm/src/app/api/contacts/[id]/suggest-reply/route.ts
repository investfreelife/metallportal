import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'
import {
  LLM_MODEL_GENERAL,
  LLM_MODEL_FALLBACK,
  shouldFallbackOnError,
} from '@/lib/llm-models'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { id: contactId } = await params
  const { last_message, channel_hint } = await req.json().catch(() => ({}))
  const supabase = getSupabase()

  // Load contact info
  const { data: contact } = await supabase.from('contacts')
    .select('full_name, email, telegram, telegram_chat_id, ai_segment, ai_score, last_contact_at')
    .eq('id', contactId).single()

  const name = contact?.full_name?.split(' ')[0] ?? 'клиент'
  const hasTelegram = Boolean(contact?.telegram_chat_id)
  const hasEmail = Boolean(contact?.email)

  // Determine best channel
  const recommendedChannel: 'telegram' | 'email' =
    channel_hint ?? (hasTelegram ? 'telegram' : hasEmail ? 'email' : 'telegram')

  const systemPrompt = `Ты менеджер по продажам металлопроката. Отвечай кратко, по-русски, профессионально и дружелюбно. Клиент: ${contact?.full_name ?? 'клиент'}, сегмент: ${contact?.ai_segment ?? 'неизвестно'}.`
  const userMsg = `Клиент написал: "${last_message}". Напиши ответ менеджера (2-3 предложения).`

  // Try OpenRouter — primary free model; fall back to paid gpt-4o-mini on
  // rate-limit / outage. After this we still cascade to Anthropic / OpenAI direct.
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey && last_message) {
    const callOpenRouter = (model: string) =>
      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://metallportal-crm2.vercel.app',
          'X-Title': 'МеталлПортал CRM',
        },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      })
    try {
      let resp = await callOpenRouter(LLM_MODEL_GENERAL)
      if (!resp.ok && shouldFallbackOnError(resp.status)) {
        resp = await callOpenRouter(LLM_MODEL_FALLBACK)
      }
      const ai = await resp.json()
      const text = ai.choices?.[0]?.message?.content?.trim()
      if (text) return NextResponse.json({ text, channel: recommendedChannel, source: 'openrouter' })
    } catch { /* fallback */ }
  }

  // Try Anthropic (Claude Haiku — fast & cheap) — key already in project
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey && last_message) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-20240307',
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })
      const ai = await resp.json()
      const text = ai.content?.[0]?.text?.trim()
      if (text) return NextResponse.json({ text, channel: recommendedChannel, source: 'anthropic' })
    } catch { /* fallback */ }
  }

  // Try OpenAI directly if key set
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey && last_message) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', max_tokens: 200,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        }),
      })
      const ai = await resp.json()
      const text = ai.choices?.[0]?.message?.content?.trim()
      if (text) return NextResponse.json({ text, channel: recommendedChannel, source: 'openai' })
    } catch { /* fallback to template */ }
  }

  // Smart template reply based on last message or segment
  const msg = (last_message ?? '').toLowerCase()
  let text = ''

  if (msg.includes('цен') || msg.includes('стоим') || msg.includes('прайс')) {
    text = `Добрый день, ${name}! Подготовлю актуальный прайс в течение 15 минут и пришлю вам.`
  } else if (msg.includes('доставк') || msg.includes('везёт') || msg.includes('привезёт')) {
    text = `${name}, доставка в вашем регионе есть. Уточните адрес и объём — рассчитаю стоимость.`
  } else if (msg.includes('счёт') || msg.includes('оплат') || msg.includes('реквизит')) {
    text = `Добрый день, ${name}! Выставляю счёт — будет на вашей почте в течение 30 минут.`
  } else if (msg.includes('сколько') || msg.includes('наличи') || msg.includes('есть ли')) {
    text = `${name}, проверю наличие на складе прямо сейчас и сообщу вам.`
  } else {
    text = `Добрый день, ${name}! Спасибо за обращение. Уточните, пожалуйста, детали — свяжусь с вами в ближайшее время.`
  }

  return NextResponse.json({ text, channel: recommendedChannel, source: 'template' })
}

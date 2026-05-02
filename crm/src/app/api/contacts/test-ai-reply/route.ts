import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { message } = await req.json().catch(() => ({}))
  const testMsg = message ?? 'Добрый день! Хочу узнать цену на арматуру 12мм, 5 тонн.'

  const system = 'Ты менеджер по продажам металлопроката. Отвечай кратко, по-русски, профессионально и дружелюбно.'
  const userContent = `Клиент написал: "${testMsg}". Напиши ответ менеджера (2-3 предложения).`

  // Try OpenRouter
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://metallportal-crm2.vercel.app',
          'X-Title': 'МеталлПортал CRM',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini', max_tokens: 200,
          messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
        }),
      })
      const ai = await resp.json()
      const text = ai.choices?.[0]?.message?.content?.trim()
      if (text) return NextResponse.json({ text, source: 'openrouter' })
    } catch { /* fallback */ }
  }

  return NextResponse.json({ text: 'Добрый день! Уточним наличие арматуры 12мм на складе и пришлём актуальный прайс в течение 15 минут.', source: 'template' })
}

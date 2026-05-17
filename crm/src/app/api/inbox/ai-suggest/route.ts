import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'

/**
 * POST /api/inbox/ai-suggest
 *
 * Принимает {channel, contact_name, subject, body} → возвращает short B2B
 * reply suggestion для composer.
 *
 * Phase 1 implementation: simple template-based rules + Claude / OpenAI
 * callout если ANTHROPIC_API_KEY или OPENAI_API_KEY доступны.
 *
 * Phase 3: integrate с Алексей daemon через alexey_chat table — pending
 * (alexey_chat table doesn't exist yet).
 */

export const dynamic = 'force-dynamic'

function checkAuth(request: NextRequest): { ok: true } | { ok: false; error: NextResponse } {
  const session = getSessionFromRequest(request.headers.get('cookie'))
  if (session) return { ok: true }
  const token = request.headers.get('x-agent-token')
  const expected = process.env.AGENT_WEBHOOK_TOKEN
  if (expected && token && token === expected) return { ok: true }
  return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

function templateSuggestion(channel: string, name: string | null, subject: string | null, body: string): string {
  const greeting = name ? `Здравствуйте, ${name.split(' ')[0]}!` : 'Здравствуйте!'

  // Channel-specific length tuning
  const isShort = channel === 'sms' || channel === 'telegram' || channel === 'whatsapp'

  // Crude intent detection
  const lower = (body || '').toLowerCase()
  const isPriceRequest = /цен|стоимость|сколько стоит|почём|расценк/.test(lower)
  const isAvailability = /наличие|есть в наличии|в наличии|остатки/.test(lower)
  const isOrder = /заказ|купить|оформить/.test(lower)
  const isDelivery = /доставк|сроки|когда привез|когда придет/.test(lower)

  if (isPriceRequest) {
    return isShort
      ? `${greeting} Цены актуальные пришлю в течение 30 минут. Уточните позицию + объём?`
      : `${greeting}\n\nСпасибо за интерес. Цены актуальные и спецификации пришлю в течение 30 минут. Уточните, пожалуйста, конкретную позицию (марка/диаметр/толщина) и желаемый объём — это поможет дать точное предложение.\n\nС уважением, МеталлПортал`
  }
  if (isAvailability) {
    return isShort
      ? `${greeting} Проверю по складу и отвечу в течение 30 минут. Какая позиция?`
      : `${greeting}\n\nПроверю наличие на складе и отвечу в течение 30 минут. Уточните, пожалуйста, артикул или название позиции + объём.\n\nС уважением, МеталлПортал`
  }
  if (isOrder) {
    return isShort
      ? `${greeting} Оформим заказ. Свяжемся в течение 15 минут для подтверждения деталей.`
      : `${greeting}\n\nСпасибо за заказ. Менеджер свяжется с вами в течение 15 минут для подтверждения деталей: количество, способ оплаты, реквизиты получателя, адрес доставки.\n\nС уважением, МеталлПортал`
  }
  if (isDelivery) {
    return isShort
      ? `${greeting} Доставка по Москве — на следующий день, регионы — 2–5 дней.`
      : `${greeting}\n\nДоставка по Москве и МО — на следующий рабочий день, регионы — 2–5 дней транспортной компанией. Точные сроки и стоимость доставки пришлю после уточнения адреса и веса груза.\n\nС уважением, МеталлПортал`
  }

  return isShort
    ? `${greeting} Спасибо за обращение. Уточните детали — отвечу в течение 30 минут.`
    : `${greeting}\n\nСпасибо за обращение в МеталлПортал. Менеджер ответит на ваш вопрос в течение 30 минут в рабочее время (Пн–Пт 9:00–18:00 МСК).\n\nС уважением, МеталлПортал`
}

async function llmSuggestion(channel: string, name: string | null, subject: string | null, body: string): Promise<string | null> {
  const anthKey = process.env.ANTHROPIC_API_KEY
  if (anthKey) {
    try {
      const isShort = channel === 'sms' || channel === 'telegram' || channel === 'whatsapp'
      const sysPrompt = `Ты — B2B менеджер компании МеталлПортал (металлопрокат, поставка металлических изделий по РФ). Отвечай ${isShort ? 'кратко (1-2 предложения)' : 'дружелюбно но коротко (2-4 предложения)'} на русском. Без преамбулы. Без лишних общих слов. Если не хватает деталей — спроси конкретно.`
      const userPrompt = `Канал: ${channel}\nКлиент: ${name || 'не представился'}\n${subject ? `Тема: ${subject}\n` : ''}Сообщение:\n${body || '(пусто)'}\n\nДай готовый текст ответа.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: isShort ? 200 : 500,
          system: sysPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const text = data?.content?.[0]?.text
      return text || null
    } catch {
      return null
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const auth = checkAuth(request)
  if (!auth.ok) return auth.error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const channel = String(body.channel || 'email')
  const name = body.contact_name ?? null
  const subject = body.subject ?? null
  const text = String(body.body || '')

  // Try LLM first
  let suggestion = await llmSuggestion(channel, name, subject, text)
  let source = 'llm'

  if (!suggestion) {
    suggestion = templateSuggestion(channel, name, subject, text)
    source = 'template'
  }

  return NextResponse.json({ suggestion, source })
}

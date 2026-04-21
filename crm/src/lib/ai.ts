/**
 * GPT-4o via OpenRouter — CRM AI core
 * Analyzes new leads and generates personalized suggested actions.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const REFERER = 'https://metallportal-crm2.vercel.app'

interface LeadContext {
  name?: string | null
  phone?: string | null
  email?: string | null
  company?: string | null
  form_type: string
  message?: string | null
  items?: unknown[]
  total?: number | null
  utm_source?: string | null
  utm_campaign?: string | null
}

interface AIAnalysis {
  reasoning: string
  suggested_message: string
  action_type: 'call' | 'send_proposal' | 'send_message' | 'schedule'
  priority: 'high' | 'medium' | 'low'
  score_adjustment: number
  segment: string
  next_action_hint: string
}

export async function analyzeNewLead(ctx: LeadContext): Promise<AIAnalysis | null> {
  if (!OPENROUTER_KEY) return null

  const contactInfo = [
    ctx.name && `Имя: ${ctx.name}`,
    ctx.company && `Компания: ${ctx.company}`,
    ctx.phone && `Телефон: ${ctx.phone}`,
    ctx.email && `Email: ${ctx.email}`,
    ctx.message && `Сообщение: ${ctx.message}`,
    ctx.total && `Сумма заказа: ${ctx.total.toLocaleString('ru')} ₽`,
    ctx.items && `Товары: ${JSON.stringify(ctx.items).slice(0, 300)}`,
    ctx.utm_source && `Источник: ${ctx.utm_source}`,
    ctx.utm_campaign && `Кампания: ${ctx.utm_campaign}`,
  ].filter(Boolean).join('\n')

  const prompt = `Ты — ИИ-ассистент CRM для компании МеталлПортал (продажа металлопроката B2B/B2C).

Новое обращение (тип: ${ctx.form_type}):
${contactInfo}

Ответь строго JSON (без markdown) со следующими полями:
{
  "reasoning": "1-2 предложения ПОЧЕМУ ты предлагаешь это действие",
  "suggested_message": "Готовый текст сообщения/звонка менеджера клиенту (1-3 предложения, обращение по имени если есть)",
  "action_type": "call|send_proposal|send_message|schedule",
  "priority": "high|medium|low",
  "score_adjustment": число от -10 до +20 (поправка к текущему скорингу),
  "segment": "Строитель|Завод|Перекупщик|Физлицо|Неизвестно",
  "next_action_hint": "Краткая подсказка менеджеру (1 предложение)"
}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': 'MetallPortal CRM AI',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 600,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) return null

    return JSON.parse(text) as AIAnalysis
  } catch {
    return null
  }
}

export async function generateWeeklyInsight(stats: {
  total_contacts: number
  new_this_week: number
  calls_made: number
  conversion_rate: number
  top_sources: string[]
}): Promise<string> {
  if (!OPENROUTER_KEY) return ''

  const prompt = `Ты — аналитик CRM МеталлПортал. Данные за неделю:
- Новых контактов: ${stats.new_this_week}
- Всего в базе: ${stats.total_contacts}
- Звонков: ${stats.calls_made}
- Конверсия в сделку: ${stats.conversion_rate}%
- Топ источники: ${stats.top_sources.join(', ')}

Напиши краткий (3-4 предложения) аналитический комментарий с 1-2 рекомендациями. Только текст, без JSON.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 300,
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  } catch {
    return ''
  }
}

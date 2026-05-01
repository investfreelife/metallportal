import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { orderRatelimit, getClientIp } from '@/lib/ratelimit'
import { verifyTurnstile } from '@/lib/turnstile'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// Items use `total_price` (per-line subtotal) and optional `unit`,
// matching how the cart/AI-search clients call this endpoint today.
const OrderItemSchema = z.object({
  product_id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(200),
  quantity: z.number().min(0).max(10_000_000),
  unit: z.string().max(20).optional(),
  total_price: z.number().min(0).max(1_000_000_000),
})

const OrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1).max(100),
  total_price: z.number().min(0).max(1_000_000_000),
  contact: z.object({
    name: z.string().min(1).max(200).optional(),
    phone: z
      .string()
      .regex(/^\+?[0-9 ()\-]{7,30}$/, 'invalid phone')
      .optional(),
    email: z.string().email().max(254).optional(),
    company: z.string().max(200).optional(),
    comment: z.string().max(2000).optional(),
  }).refine(
    (c) => Boolean(c.phone || c.email),
    { message: 'phone or email required' },
  ),
  source: z.string().max(40).optional(),
  turnstile_token: z.string().min(1).max(2048),
})

export async function POST(req: NextRequest) {
  // 1. IP-based rate-limit (5 / 5 min)
  const ip = getClientIp(req)
  const rl = await orderRatelimit.limit(ip)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Слишком много заявок. Попробуйте через 5 минут.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.reset),
        },
      },
    )
  }

  // 2. Body parse + zod validation
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = OrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { items, total_price, contact, source, turnstile_token } = parsed.data

  // 3. Cloudflare Turnstile CAPTCHA
  const turnstileOk = await verifyTurnstile(turnstile_token, ip)
  if (!turnstileOk) {
    return NextResponse.json({ error: 'Captcha failed' }, { status: 403 })
  }

  // 4. Business logic — preserved from prior version, with the same
  //    contact/deal/ai_queue/Telegram side-effects + background AI agent.

  let contactId: string | null = null
  if (contact.phone || contact.email) {
    const query = contact.phone
      ? supabase.from('contacts').select('id').eq('tenant_id', TENANT_ID).eq('phone', contact.phone)
      : supabase.from('contacts').select('id').eq('tenant_id', TENANT_ID).eq('email', contact.email!)

    const { data: existing } = await query.maybeSingle()

    if (existing) {
      contactId = existing.id as string
    } else {
      const { data: newContact } = await supabase.from('contacts').insert({
        tenant_id: TENANT_ID,
        full_name: contact.name || 'Клиент с сайта',
        phone: contact.phone,
        email: contact.email,
        source: source || 'ai_search',
        ai_score: 65,
        ai_segment: 'hot',
      } as never).select('id').single()
      contactId = (newContact as { id: string } | null)?.id ?? null
    }
  }

  const itemsList = items
    .map((i) => `${i.name} ${i.quantity}${i.unit ? ' ' + i.unit : ''}`)
    .join(', ')

  const { data: deal } = await supabase.from('deals').insert({
    tenant_id: TENANT_ID,
    contact_id: contactId,
    title: `Заявка с сайта: ${itemsList.substring(0, 80)}`,
    amount: total_price,
    stage: 'new',
    ai_win_probability: 70,
  } as never).select('id').single()

  const itemsText = items
    .map((i) =>
      `• ${i.name} ${i.quantity}${i.unit ? ' ' + i.unit : ''} = ${i.total_price.toLocaleString('ru-RU')} ₽`,
    )
    .join('\n')

  await supabase.from('ai_queue').insert({
    tenant_id: TENANT_ID,
    contact_id: contactId,
    deal_id: (deal as { id: string } | null)?.id,
    action_type: 'send_proposal',
    priority: 'urgent',
    subject: `🔥 Новая заявка с AI поиска: ${itemsList.substring(0, 60)}`,
    content: `Клиент: ${contact.name || 'Неизвестен'}
Телефон: ${contact.phone || '—'}
Email: ${contact.email || '—'}

Позиции:
${itemsText}

Итого: ${total_price.toLocaleString('ru-RU')} ₽${contact.comment ? `\n\nКомментарий: ${contact.comment}` : ''}`,
    ai_reasoning: 'Клиент оформил заявку через AI поиск на сайте. Горячий лид — связаться в течение 15 минут.',
    status: 'pending',
  } as never)

  // Telegram manager notification
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID
  if (botToken && chatId) {
    const msg = `🔥 *Новая заявка с сайта!*\n\n${itemsList}\n\n💰 *${total_price.toLocaleString('ru-RU')} ₽*\n📞 ${contact.phone || contact.email || 'нет контакта'}\n👤 ${contact.name || '—'}`
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
    }).catch(() => {})
  }

  // Background AI agent on harlan-ai (non-blocking)
  const aiUrl = process.env.NEXT_PUBLIC_AI_URL
  const aiKey = process.env.AI_API_KEY
  if (aiUrl && aiKey && contactId) {
    fetch(`${aiUrl}/api/agents/sales/process-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': aiKey },
      body: JSON.stringify({
        contact_id: contactId,
        full_name: contact.name,
        phone: contact.phone,
        email: contact.email,
        message: itemsList,
        source: 'ai_search',
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, deal_id: (deal as { id: string } | null)?.id })
}

import { NextRequest, NextResponse } from 'next/server'

const CRM_WEBHOOK = 'https://metallportal-crm2.vercel.app/api/webhook'
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'
const BOT_USERNAME = 'metallportal_bot'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return '+7' + digits.slice(1)
  }
  if (digits.length === 10) return '+7' + digits
  if (digits.length > 0) return '+' + digits
  return raw
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, email, comment, message, date, time, product, area, price, type } = body

    if (!name && !phone && !email) {
      return NextResponse.json({ error: 'Укажите имя или телефон' }, { status: 400, headers: CORS })
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null
    const formType = type || 'callback'
    const msgParts = [
      comment || message,
      date && time ? `Удобное время: ${date} в ${time}` : null,
      product ? `Товар: ${product}` : null,
      area ? `Площадь: ${area} м²` : null,
      price ? `Стоимость: ${Number(price).toLocaleString('ru')} ₽` : null,
    ].filter(Boolean).join('\n')

    const webhookSecret = process.env.WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('WEBHOOK_SECRET environment variable is required')

    const crmRes = await fetch(CRM_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({
        type: formType,
        tenant_id: TENANT_ID,
        name: name || null,
        phone: normalizedPhone,
        email: email || null,
        message: msgParts || null,
      }),
    })

    if (!crmRes.ok) {
      const errText = await crmRes.text()
      console.error('[/api/contact] CRM webhook error:', crmRes.status, errText)
    }

    // Ссылка для подключения Telegram — клиент получает ответы в боте
    const phoneDigits = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : null
    const tgLink = phoneDigits
      ? `https://t.me/${BOT_USERNAME}?start=client_${phoneDigits}`
      : `https://t.me/${BOT_USERNAME}`

    return NextResponse.json({ ok: true, tg_link: tgLink, phone: normalizedPhone }, { headers: CORS })
  } catch (e: unknown) {
    console.error('[/api/contact] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS })
  }
}

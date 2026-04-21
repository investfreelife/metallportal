import { NextRequest, NextResponse } from 'next/server'

const CRM_WEBHOOK = 'https://metallportal-crm2.vercel.app/api/webhook'
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, email, comment, message, date, time, product, area, price, type } = body

    const formType = type || (product ? 'callback' : 'callback')
    const msgParts = [
      comment || message,
      date && time ? `Удобное время: ${date} в ${time}` : null,
      product ? `Товар: ${product}` : null,
      area ? `Площадь: ${area} м²` : null,
      price ? `Стоимость: ${Number(price).toLocaleString('ru')} ₽` : null,
    ].filter(Boolean).join('\n')

    // Fire-and-forget to CRM
    fetch(CRM_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: formType,
        tenant_id: TENANT_ID,
        name: name || null,
        phone: phone || null,
        email: email || null,
        message: msgParts || null,
      }),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

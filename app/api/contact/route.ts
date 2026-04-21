import { NextRequest, NextResponse } from 'next/server'

const CRM_WEBHOOK = 'https://metallportal-crm2.vercel.app/api/webhook'
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

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

    const formType = type || 'callback'
    const msgParts = [
      comment || message,
      date && time ? `Удобное время: ${date} в ${time}` : null,
      product ? `Товар: ${product}` : null,
      area ? `Площадь: ${area} м²` : null,
      price ? `Стоимость: ${Number(price).toLocaleString('ru')} ₽` : null,
    ].filter(Boolean).join('\n')

    const crmRes = await fetch(CRM_WEBHOOK, {
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
    })

    if (!crmRes.ok) {
      const errText = await crmRes.text()
      console.error('[/api/contact] CRM webhook error:', crmRes.status, errText)
    }

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e: unknown) {
    console.error('[/api/contact] error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS })
  }
}

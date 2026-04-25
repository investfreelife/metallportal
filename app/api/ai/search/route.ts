import { NextRequest, NextResponse } from 'next/server'

const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
const AI_KEY = process.env.AI_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${AI_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    // Нормализуем: старый формат {products, recommendation, alternatives} → новый {items, ...}
    if (data.products !== undefined && data.items === undefined) {
      const items = (data.products || []).map((p: any) => ({
        name: p.name || p.title || 'Товар',
        spec: p.spec || p.description || p.category || '',
        quantity: p.quantity || 1,
        unit: p.unit || 'тонн',
        price_per_unit: p.price || p.price_per_unit || 0,
        total_price: (p.price || 0) * (p.quantity || 1),
        in_stock: p.in_stock ?? p.available ?? true,
        product_id: p.id || p.product_id || null,
      }))
      return NextResponse.json({
        items,
        total_price: items.reduce((s: number, i: any) => s + i.total_price, 0),
        recommendation: data.recommendation || '',
        clarifying_question: null,
        missing_info: [],
      })
    }

    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }
}

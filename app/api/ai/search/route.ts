import { NextRequest, NextResponse } from 'next/server'

const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
const AI_KEY = process.env.AI_API_KEY || ''

async function supabaseSearch(query: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const words = query.trim().split(/\s+/).filter(w => w.length > 1)
  if (!words.length) return null

  let searchFilter: string
  if (words.length === 1) {
    searchFilter = `name=ilike.${encodeURIComponent('%' + words[0] + '%')}`
  } else {
    const conditions = words.map(w => `name.ilike.${encodeURIComponent('%' + w + '%')}`).join(',')
    searchFilter = `and=(${conditions})`
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/products?select=id,name,slug,unit,gost,price_items(base_price,discount_price)&${searchFilter}&limit=10&order=name.asc`,
      { headers }
    )
    const products: any[] = await res.json()
    if (!Array.isArray(products) || !products.length) return null

    const items = products.map((p: any) => {
      const pi = Array.isArray(p.price_items) && p.price_items.length ? p.price_items[0] : null
      const price = pi ? Math.round(Number(pi.discount_price ?? pi.base_price)) : 0
      return {
        name: p.name,
        spec: p.gost || '',
        quantity: 1,
        unit: p.unit || 'т',
        price_per_unit: price,
        total_price: price,
        in_stock: price > 0,
        product_id: p.id,
      }
    })

    return {
      items,
      total_price: items.reduce((s: number, i: any) => s + i.total_price, 0),
      recommendation: 'Цены актуальны. Точное наличие и сроки уточнит менеджер.',
      clarifying_question: null,
      missing_info: [],
    }
  } catch {
    return null
  }
}

function normalizeResponse(data: any) {
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
    return {
      items,
      total_price: items.reduce((s: number, i: any) => s + i.total_price, 0),
      recommendation: data.recommendation || '',
      clarifying_question: null,
      missing_info: [],
    }
  }
  return data
}

export const maxDuration = 55

export async function POST(req: NextRequest) {
  const body = await req.json()
  const query: string = body.query || ''

  try {
    const res = await fetch(`${AI_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(52000),
    })
    const raw = await res.json()
    const normalized = normalizeResponse(raw)

    // Если AI вернул пустые items — ищем в нашем прайсе
    if (!normalized.items?.length && query) {
      const fb = await supabaseSearch(query)
      if (fb) return NextResponse.json(fb)
    }

    return NextResponse.json(normalized, { status: res.status })
  } catch {
    // AI недоступен — ищем в нашем прайсе
    if (query) {
      const fb = await supabaseSearch(query)
      if (fb) return NextResponse.json(fb)
    }
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
const AI_KEY = process.env.AI_API_KEY || ''

// Эталонные цены РФ 2024 (₽/т)
const REF_PRICES: Array<{ keywords: string[]; name: string; unit: string; price: number }> = [
  { keywords: ['арматура', 'армату', 'арм', 'a500', 'а500', 'a400', 'а400'], name: 'Арматура А500С', unit: 'тонн', price: 75000 },
  { keywords: ['труба профил', 'профильная', 'профиль', '40х40', '60х60', '80х80', '100х100', '50х50'], name: 'Труба профильная ст3', unit: 'тонн', price: 90000 },
  { keywords: ['труба вгп', 'вгп', 'водогазо', 'ду15', 'ду20', 'ду25', 'ду32', 'ду40', 'ду50'], name: 'Труба ВГП', unit: 'тонн', price: 85000 },
  { keywords: ['труба бесшовн', 'бесшовн'], name: 'Труба бесшовная', unit: 'тонн', price: 110000 },
  { keywords: ['труба', 'трубу', 'трубы'], name: 'Труба стальная', unit: 'тонн', price: 88000 },
  { keywords: ['лист горяче', 'г/к', 'гк лист', 'лист 10', 'лист 12', 'лист 8', 'лист 6', 'лист 4'], name: 'Лист горячекатаный', unit: 'тонн', price: 85000 },
  { keywords: ['лист холодно', 'х/к', 'хк лист'], name: 'Лист холоднокатаный', unit: 'тонн', price: 95000 },
  { keywords: ['лист', 'листов', 'листу'], name: 'Лист стальной', unit: 'тонн', price: 85000 },
  { keywords: ['балка', 'двутавр', 'двутавровая'], name: 'Балка двутавровая', unit: 'тонн', price: 82000 },
  { keywords: ['швеллер', 'шв'], name: 'Швеллер', unit: 'тонн', price: 83000 },
  { keywords: ['уголок', 'угол'], name: 'Уголок стальной', unit: 'тонн', price: 78000 },
  { keywords: ['полоса', 'полосу'], name: 'Полоса стальная', unit: 'тонн', price: 76000 },
  { keywords: ['круг', 'пруток'], name: 'Круг стальной', unit: 'тонн', price: 80000 },
]

function extractQty(segment: string): number {
  const m = segment.match(/(\d+(?:[.,]\d+)?)\s*(?:т(?:онн?)?|штук|шт|м(?:етр)?)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : 1
}

function fallbackSearch(query: string): ReturnType<typeof normalizeResponse> {
  const q = query.toLowerCase()
  const usedIndices = new Set<number>()
  const items: any[] = []

  // Ищем все вхождения металлопроката в запросе
  for (let i = 0; i < REF_PRICES.length; i++) {
    if (usedIndices.has(i)) continue
    const ref = REF_PRICES[i]
    const matchedKw = ref.keywords.find(k => q.includes(k))
    if (!matchedKw) continue

    usedIndices.add(i)
    const pos = q.indexOf(matchedKw)
    // Берём фрагмент вокруг найденного слова (±60 символов) для извлечения кол-ва и размера
    const segment = q.slice(Math.max(0, pos - 5), pos + 80)

    const qty = extractQty(segment)
    const sizeMatch = segment.match(/(\d+[х×x]\d+(?:[х×x]\d+)?|\b\d{1,3}(?:\.\d+)?мм\b|\d+\/\d+|ду\s*\d+|\bd\s*\d+)/i)
    const spec = sizeMatch ? sizeMatch[0].toUpperCase().replace(/\s+/g, '') : ''

    items.push({
      name: ref.name + (spec ? ` ${spec}` : ''),
      spec: spec || 'ГОСТ, наличие уточняется',
      quantity: qty,
      unit: ref.unit,
      price_per_unit: ref.price,
      total_price: qty * ref.price,
      in_stock: true,
      product_id: null,
    })
  }

  if (!items.length) return null

  return {
    items,
    total_price: items.reduce((s, i) => s + i.total_price, 0),
    recommendation: 'Цены ориентировочные. Точную стоимость и наличие уточнит менеджер.',
    clarifying_question: null,
    missing_info: [],
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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const query: string = body.query || ''

  try {
    const res = await fetch(`${AI_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    })
    const raw = await res.json()
    const normalized = normalizeResponse(raw)

    // Если AI вернул пустые items — используем keyword fallback
    if (!normalized.items?.length && query) {
      const fb = fallbackSearch(query)
      if (fb) return NextResponse.json(fb)
    }

    return NextResponse.json(normalized, { status: res.status })
  } catch {
    // AI недоступен — используем keyword fallback
    if (query) {
      const fb = fallbackSearch(query)
      if (fb) return NextResponse.json(fb)
    }
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }
}

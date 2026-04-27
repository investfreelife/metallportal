import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 10

// ─── Стоп-слова (не несут смысл при поиске товара) ───────────────────────────
const STOP = new Set([
  'тонн','тонна','тонны','тоннах','метров','метр','метра','метрах',
  'штук','штука','шт','кг','килограмм','килограмма','кило',
  'т','м','мм','см','л','гост','класс','марка',
  'и','в','для','на','от','до','из','по','не','или','мне','нужн','нужна','нужно',
  'купить','заказать','хочу','нужны','дайте','пришлите',
])

// ─── Извлечь слова для поиска (убрать числа, размеры, стоп-слова) ────────────
function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\d+[х×xх]\d+(?:[х×xх]\d+)?/g, ' ')   // убрать 40х40х3
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:мм|см|м|т|кг|шт)?\b/g, ' ')  // убрать числа с единицами
    .split(/[\s,;./\\-]+/)
    .map(w => w.replace(/[^а-яёa-z]/gi, ''))
    .filter(w => w.length > 2 && !STOP.has(w))
    .slice(0, 4)
}

// ─── Извлечь количество и единицу из запроса ────────────────────────────────
function parseQty(text: string): { quantity: number; unit: string } {
  const t = text.toLowerCase()
  const unitMap: Array<[RegExp, string]> = [
    [/(\d+(?:[.,]\d+)?)\s*(?:тонн|тонна|тонны|т\b)/,   'т'],
    [/(\d+(?:[.,]\d+)?)\s*(?:метров|метра|метр|м\b)/,   'м'],
    [/(\d+(?:[.,]\d+)?)\s*(?:килограмм|кило|кг\b)/,     'кг'],
    [/(\d+(?:[.,]\d+)?)\s*(?:штук|штука|шт\b)/,         'шт'],
    [/(\d+(?:[.,]\d+)?)\s*(?:листов|лист\b)/,           'шт'],
    [/(\d+(?:[.,]\d+)?)/,                                ''],   // просто число без единицы
  ]
  for (const [re, unit] of unitMap) {
    const m = t.match(re)
    if (m) {
      return { quantity: parseFloat(m[1].replace(',', '.')), unit }
    }
  }
  return { quantity: 1, unit: '' }
}

// ─── Основной поиск по каталогу ──────────────────────────────────────────────
async function catalogSearch(query: string) {
  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SB_URL || !SB_KEY) return null

  const words = searchWords(query)
  if (!words.length) return null

  const { quantity, unit } = parseQty(query)

  // Сначала пробуем совпадение по ВСЕМ словам (AND)
  // Если ничего — пробуем по первому слову (OR)
  const buildFilter = (ws: string[]) => ws.length === 1
    ? `name=ilike.${encodeURIComponent('%' + ws[0] + '%')}`
    : `and=(${ws.map(w => `name.ilike.${encodeURIComponent('%' + w + '%')}`).join(',')})`

  const headers = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
  }

  async function fetchProducts(filter: string) {
    const res = await fetch(
      `${SB_URL}/rest/v1/products?select=id,name,slug,unit,gost,steel_grade,price_items(base_price,discount_price,in_stock)&${filter}&limit=8&order=name.asc`,
      { headers }
    )
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  try {
    let products = await fetchProducts(buildFilter(words))

    // Если AND дал 0 — повторяем по первым двум словам
    if (!products.length && words.length > 1) {
      products = await fetchProducts(buildFilter(words.slice(0, 2)))
    }
    // Если всё ещё 0 — по первому слову
    if (!products.length) {
      products = await fetchProducts(buildFilter([words[0]]))
    }
    if (!products.length) return null

    const items = products.map((p: any) => {
      const prices: any[] = Array.isArray(p.price_items) ? p.price_items : []
      const inStockPrices = prices.filter((pi: any) => pi.in_stock !== false && (pi.base_price || pi.discount_price))
      const pi = inStockPrices.length ? inStockPrices[0] : prices[0]
      const price = pi ? Math.round(Number(pi.discount_price ?? pi.base_price) || 0) : 0
      const itemUnit = unit || p.unit || 'т'
      const qty = quantity
      return {
        name: p.name,
        spec: [p.gost, p.steel_grade].filter(Boolean).join(', ') || '',
        quantity: qty,
        unit: itemUnit,
        price_per_unit: price,
        total_price: price * qty,
        in_stock: price > 0 && (pi?.in_stock !== false),
        product_id: p.id,
      }
    })

    return {
      items,
      total_price: items.reduce((s: number, i: any) => s + i.total_price, 0),
      recommendation: 'Цены из нашего актуального прайса. Наличие и сроки уточнит менеджер.',
      clarifying_question: null,
      missing_info: [],
    }
  } catch {
    return null
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const query: string = (body.query || '').trim()

  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }

  const result = await catalogSearch(query)
  if (result) return NextResponse.json(result)

  return NextResponse.json({
    items: [],
    total_price: 0,
    recommendation: 'По вашему запросу ничего не найдено. Уточните название товара или позвоните нам.',
    clarifying_question: 'Уточните, пожалуйста, что именно ищете — название и размер.',
    missing_info: [],
  })
}

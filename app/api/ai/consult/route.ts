/**
 * /api/ai/consult
 *
 * Двухступенчатый AI-консультант:
 * 1. Railway AI (qwen3.6-plus FREE) — понимает контекст, извлекает список нужных материалов
 * 2. Supabase — ищет каждый материал в каталоге, возвращает реальные цены
 *
 * Используется для голосового режима SmartSearch.
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || ''
const AI_KEY  = process.env.AI_API_KEY || ''
const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SB_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const STOP = new Set([
  'тонн','тонна','тонны','метров','метр','штук','шт','кг','т','м','мм',
  'гост','класс','марка','и','в','для','на','от','до','из','по',
])

function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\d+[х×x]\d+(?:[х×x]\d+)?/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, ' ')
    .split(/[\s,;./\\-]+/)
    .map(w => w.replace(/[^а-яёa-z]/gi, ''))
    .filter(w => w.length > 2 && !STOP.has(w))
    .slice(0, 4)
}

async function catalogLookup(name: string, quantity: number, unit: string) {
  if (!SB_URL || !SB_KEY) return null
  const words = searchWords(name)
  if (!words.length) return null

  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }

  const buildFilter = (ws: string[]) => ws.length === 1
    ? `name=ilike.${encodeURIComponent('%' + ws[0] + '%')}`
    : `and=(${ws.map(w => `name.ilike.${encodeURIComponent('%' + w + '%')}`).join(',')})`

  async function fetch1(filter: string) {
    const res = await fetch(
      `${SB_URL}/rest/v1/products?select=id,name,unit,gost,steel_grade,price_items(base_price,discount_price,in_stock)&${filter}&limit=1`,
      { headers }
    )
    const rows: any[] = await res.json()
    return Array.isArray(rows) ? rows : []
  }

  try {
    let rows = await fetch1(buildFilter(words))
    if (!rows.length && words.length > 1) rows = await fetch1(buildFilter(words.slice(0, 2)))
    if (!rows.length) rows = await fetch1(buildFilter([words[0]]))
    if (!rows.length) return null

    const p = rows[0]
    const prices: any[] = Array.isArray(p.price_items) ? p.price_items : []
    const pi = prices.find((x: any) => x.in_stock !== false) || prices[0]
    const price = pi ? Math.round(Number(pi.discount_price ?? pi.base_price) || 0) : 0
    const itemUnit = unit || p.unit || 'т'
    return {
      name: p.name,
      spec: [p.gost, p.steel_grade].filter(Boolean).join(', ') || '',
      quantity,
      unit: itemUnit,
      price_per_unit: price,
      total_price: price * quantity,
      in_stock: price > 0 && pi?.in_stock !== false,
      product_id: p.id,
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { query } = await req.json()
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }

  // ── Шаг 1: AI понимает контекст и извлекает список материалов ──────────────
  let advice = 'Подобрали по вашему запросу.'
  let needs: Array<{ name: string; quantity: number; unit: string }> = []

  try {
    const aiRes = await fetch(`${AI_BASE}/api/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(25000),
    })
    const aiData = await aiRes.json()
    advice = aiData.advice || advice
    needs  = Array.isArray(aiData.needs) ? aiData.needs : []
  } catch {
    // AI недоступен — попробуем найти как есть
    needs = [{ name: query, quantity: 1, unit: '' }]
  }

  if (!needs.length) {
    return NextResponse.json({
      advice,
      items: [],
      total_price: 0,
      recommendation: advice,
      clarifying_question: 'Уточните, пожалуйста, какой именно материал нужен.',
      missing_info: [],
    })
  }

  // ── Шаг 2: для каждого need ищем в каталоге реальную цену ──────────────────
  const itemsRaw = await Promise.all(
    needs.map(n => catalogLookup(n.name, n.quantity, n.unit))
  )
  const items = itemsRaw.filter(Boolean)

  const total_price = items.reduce((s: number, i: any) => s + (i?.total_price || 0), 0)

  return NextResponse.json({
    advice,
    items,
    total_price,
    recommendation: advice,
    clarifying_question: null,
    missing_info: [],
  })
}

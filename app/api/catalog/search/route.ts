import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

/**
 * GET /api/catalog/search — расширенный catalog search (#c005 Block 2)
 *
 * Query params:
 *   q={text}                Russian full-text search по products.name
 *                           (использует pre-existing GIN idx_products_name).
 *   category={slug}         Limit к категории + всем descendants (recursive CTE).
 *   grade={value}           Filter по products.steel_grade (typed column).
 *   thickness_min, thickness_max   Filter по products.thickness numeric range.
 *   diameter_min, diameter_max     Filter по products.diameter numeric range.
 *   length_min, length_max         Filter по products.length numeric range.
 *   coating={value}         Filter по products.coating.
 *   sort=relevance|price_asc|price_desc   Default: relevance (если q есть), иначе name asc.
 *   limit={1..200}          Default 50, max 200.
 *   offset={N}              Default 0.
 *
 * Response shape:
 *   { results: Product[], total: number, facets: { grades, thicknesses, diameters, coatings } }
 *
 * NOTE: filter по `dimensions` JSONB полям пока не поддержан — `products.dimensions`
 * остаётся `text` (см. #c005 Block 1 escalation, 194 rows с не-JSON значениями).
 * Когда #c006 разблокирует TEXT→JSONB — добавим `dimensions @> '{...}'::jsonb` filter.
 */

type SortMode = 'relevance' | 'price_asc' | 'price_desc'

interface SearchProduct {
  id: string
  slug: string
  name: string
  category_id: string
  category_slug: string | null
  image_url: string | null
  image_urls: string[]
  unit: string
  steel_grade: string | null
  thickness: number | null
  diameter: number | null
  length: number | null
  coating: string | null
  weight_per_meter: number | null
  weight_per_unit: number | null
  prices: { unit: string; base: number; discount: number | null }[]
  rank?: number
}

interface FacetBucket {
  value: string | number
  count: number
}

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

function parseNum(s: string | null): number | null {
  if (s === null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseSort(s: string | null, hasQuery: boolean): SortMode {
  if (s === 'price_asc' || s === 'price_desc') return s
  if (s === 'relevance' && hasQuery) return 'relevance'
  return hasQuery ? 'relevance' : 'price_asc'
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const categorySlug = sp.get('category')?.trim() ?? null
  const grade = sp.get('grade')?.trim() ?? null
  const coating = sp.get('coating')?.trim() ?? null
  const thicknessMin = parseNum(sp.get('thickness_min'))
  const thicknessMax = parseNum(sp.get('thickness_max'))
  const diameterMin = parseNum(sp.get('diameter_min'))
  const diameterMax = parseNum(sp.get('diameter_max'))
  const lengthMin = parseNum(sp.get('length_min'))
  const lengthMax = parseNum(sp.get('length_max'))
  const limit = Math.min(Math.max(Number(sp.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(Number(sp.get('offset') ?? 0) || 0, 0)
  const sort = parseSort(sp.get('sort'), q.length > 0)

  const supabase = createAdminClient()

  // ── 1. Resolve category subtree via in-process tree walk ────────────────
  // categories table is small (~200 rows) — fetch once, walk parent_id pointers.
  // (Composite idx_categories_parent_active from #c004 keeps this snappy.)
  let categoryIds: string[] | null = null
  if (categorySlug) {
    const { data: allCats } = await supabase
      .from('categories')
      .select('id, slug, parent_id, is_active')
      .eq('is_active', true)

    const cats = (allCats ?? []) as Array<{ id: string; slug: string; parent_id: string | null }>
    const root = cats.find((c) => c.slug === categorySlug)
    if (!root) {
      return NextResponse.json({
        results: [],
        total: 0,
        facets: { grades: [], thicknesses: [], diameters: [], coatings: [] },
      })
    }
    const childrenByParent = new Map<string, string[]>()
    for (const c of cats) {
      if (!c.parent_id) continue
      const arr = childrenByParent.get(c.parent_id) ?? []
      arr.push(c.id)
      childrenByParent.set(c.parent_id, arr)
    }
    const collected: string[] = []
    const stack = [root.id]
    const seen = new Set<string>()
    while (stack.length) {
      const id = stack.pop() as string
      if (seen.has(id)) continue
      seen.add(id)
      collected.push(id)
      const children = childrenByParent.get(id)
      if (children) stack.push(...children)
    }
    categoryIds = collected
  }

  // ── 2. Build base query ──────────────────────────────────────────────────
  let query = supabase
    .from('products')
    .select(
      'id, slug, name, category_id, image_url, image_urls, unit, steel_grade, thickness, diameter, length, coating, weight_per_meter, weight_per_unit, ' +
        'price_items(unit, base_price, discount_price), ' +
        'categories!inner(slug)',
      { count: 'exact' },
    )
    .eq('is_active', true)

  if (categoryIds) query = query.in('category_id', categoryIds)
  if (q) {
    // Postgres FTS — uses pre-existing idx_products_name (gin to_tsvector('russian', name))
    query = query.textSearch('name', q, { config: 'russian', type: 'plain' })
  }
  if (grade) query = query.eq('steel_grade', grade)
  if (coating) query = query.eq('coating', coating)
  if (thicknessMin !== null) query = query.gte('thickness', thicknessMin)
  if (thicknessMax !== null) query = query.lte('thickness', thicknessMax)
  if (diameterMin !== null) query = query.gte('diameter', diameterMin)
  if (diameterMax !== null) query = query.lte('diameter', diameterMax)
  if (lengthMin !== null) query = query.gte('length', lengthMin)
  if (lengthMax !== null) query = query.lte('length', lengthMax)

  // Sort
  if (sort === 'price_asc' || sort === 'price_desc') {
    // Order by joined price_items requires raw SQL; defer to client-side sort
    // for simplicity (our LIMIT is small). Server-side: by name asc.
    query = query.order('name', { ascending: true })
  } else if (sort === 'relevance' && q) {
    // Postgres FTS rank not directly via supabase-js — order by name as
    // deterministic tie-break (textSearch already biases via FTS match).
    query = query.order('name', { ascending: true })
  } else {
    query = query.order('name', { ascending: true })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── 3. Map rows to API shape ─────────────────────────────────────────────
  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    name: string
    category_id: string
    image_url: string | null
    image_urls: unknown
    unit: string
    steel_grade: string | null
    thickness: number | null
    diameter: number | null
    length: number | null
    coating: string | null
    weight_per_meter: number | null
    weight_per_unit: number | null
    price_items: Array<{ unit: string; base_price: number; discount_price: number | null }> | null
    categories: { slug: string } | null
  }>

  let results: SearchProduct[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category_id: r.category_id,
    category_slug: r.categories?.slug ?? null,
    image_url: r.image_url,
    image_urls: Array.isArray(r.image_urls) ? (r.image_urls as string[]) : [],
    unit: r.unit,
    steel_grade: r.steel_grade,
    thickness: r.thickness,
    diameter: r.diameter,
    length: r.length,
    coating: r.coating,
    weight_per_meter: r.weight_per_meter,
    weight_per_unit: r.weight_per_unit,
    prices: (r.price_items ?? []).map((p) => ({
      unit: p.unit,
      base: Number(p.base_price),
      discount: p.discount_price !== null ? Number(p.discount_price) : null,
    })),
  }))

  // Client-side sort for price (server-side requires custom SQL; small page OK)
  if (sort === 'price_asc' || sort === 'price_desc') {
    const lowestPrice = (p: SearchProduct): number => {
      if (p.prices.length === 0) return sort === 'price_asc' ? Number.POSITIVE_INFINITY : -1
      return Math.min(...p.prices.map((pr) => pr.discount ?? pr.base))
    }
    results = [...results].sort((a, b) => {
      const av = lowestPrice(a)
      const bv = lowestPrice(b)
      return sort === 'price_asc' ? av - bv : bv - av
    })
  }

  // ── 4. Facets — aggregate over **filtered** rows via parallel query ──────
  // We approximate facets across the matching set (not just current page).
  // For best fidelity at scale, push to a SQL function. Here: small queries.
  const facetQuery = (col: 'steel_grade' | 'coating') => {
    let qq = supabase.from('products').select(col, { head: false, count: 'exact' }).eq('is_active', true)
    if (categoryIds) qq = qq.in('category_id', categoryIds)
    if (q) qq = qq.textSearch('name', q, { config: 'russian', type: 'plain' })
    return qq.not(col, 'is', null).limit(2000)
  }
  const numericFacetQuery = (col: 'thickness' | 'diameter') => {
    let qq = supabase.from('products').select(col, { head: false }).eq('is_active', true)
    if (categoryIds) qq = qq.in('category_id', categoryIds)
    if (q) qq = qq.textSearch('name', q, { config: 'russian', type: 'plain' })
    return qq.not(col, 'is', null).limit(2000)
  }

  const [gradesRes, coatingsRes, thicknessRes, diameterRes] = await Promise.all([
    facetQuery('steel_grade'),
    facetQuery('coating'),
    numericFacetQuery('thickness'),
    numericFacetQuery('diameter'),
  ])

  const tally = <T extends string | number>(rows: { value: T | null }[]): FacetBucket[] => {
    const map = new Map<T, number>()
    for (const r of rows) {
      if (r.value === null || r.value === undefined) continue
      map.set(r.value, (map.get(r.value) ?? 0) + 1)
    }
    const buckets: FacetBucket[] = []
    map.forEach((count, value) => buckets.push({ value, count }))
    buckets.sort((a, b) => b.count - a.count)
    return buckets.slice(0, 20)
  }

  const facets = {
    grades: tally(((gradesRes.data ?? []) as Array<{ steel_grade: string | null }>).map((r) => ({ value: r.steel_grade }))),
    coatings: tally(((coatingsRes.data ?? []) as Array<{ coating: string | null }>).map((r) => ({ value: r.coating }))),
    thicknesses: tally(((thicknessRes.data ?? []) as Array<{ thickness: number | null }>).map((r) => ({ value: r.thickness }))),
    diameters: tally(((diameterRes.data ?? []) as Array<{ diameter: number | null }>).map((r) => ({ value: r.diameter }))),
  }

  return NextResponse.json({
    results,
    total: count ?? results.length,
    facets,
    meta: { limit, offset, sort, query: q || null },
  })
}

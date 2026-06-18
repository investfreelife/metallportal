import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/dream/businesses — для 3 вкладок страницы Парсер.
 *
 * Query:
 *   ?tab=all|no_site|enriched   (default: all)
 *   ?search=...                 (по name / address / phone)
 *   ?limit=50  ?offset=0
 *
 * Возвращает items + total.
 */

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const tab = url.searchParams.get('tab') ?? 'all'
  const search = (url.searchParams.get('search') ?? '').trim()
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 300)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  const supabase = admin()

  let q = supabase
    .from('dream_businesses')
    .select('id, name, niche, city, address, phone, yandex_url, gis_url, lat, lon, has_website, website_url, rating, review_count, enriched_at, enrichment_status, dream_lead_id, discovered_at', { count: 'exact' })
    .eq('tenant_id', DREAM_TENANT_ID)

  if (tab === 'no_site') q = q.eq('has_website', 0)
  if (tab === 'enriched') q = q.not('enriched_at', 'is', null)

  if (search) {
    q = q.or(`name.ilike.%${search}%,address.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  // Сортировка: enriched сверху, потом по рейтингу/discovered
  if (tab === 'enriched') {
    q = q.order('rating', { ascending: false, nullsFirst: false }).order('enriched_at', { ascending: false })
  } else {
    q = q.order('rating', { ascending: false, nullsFirst: false }).order('discovered_at', { ascending: false })
  }

  const { data, count, error } = await q.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sergey directive 2026-06-17: у OSM-discovered бизнесов нет yandex_url
  // (Overpass его не отдаёт), но есть координаты — генерируем map_url
  // fallback по геокоординатам + текстовому поиску по адресу+названию.
  // Так клик «🗺» из таблицы парсера всегда открывает Яндекс.Карты.
  function buildMapUrl(b: any): string | null {
    if (b.yandex_url) return b.yandex_url
    if (b.lat && b.lon) {
      const ll = `${b.lon},${b.lat}`
      const txt = encodeURIComponent([b.name, b.address, 'Москва'].filter(Boolean).join(' '))
      return `https://yandex.ru/maps/?ll=${ll}&z=17&pt=${ll}&text=${txt}`
    }
    if (b.address) {
      const txt = encodeURIComponent([b.name, b.address, 'Москва'].filter(Boolean).join(' '))
      return `https://yandex.ru/maps/?text=${txt}`
    }
    return null
  }

  let items: any[] = (data ?? []).map((b: any) => ({ ...b, map_url: buildMapUrl(b) }))
  if (tab === 'enriched' && items.length > 0) {
    const leadIds = items.map((b) => b.dream_lead_id).filter(Boolean)
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('dream_leads')
        .select('id, slug')
        .in('id', leadIds)
      const slugMap = new Map((leads ?? []).map((l: any) => [l.id, l.slug]))
      items = items.map((b) => ({ ...b, dream_lead_slug: b.dream_lead_id ? slugMap.get(b.dream_lead_id) : null }))
    }
  }

  return NextResponse.json({ items, total: count ?? 0, tab, limit, offset })
}

/**
 * c027 — Landing ↔ Catalog bidirectional queries.
 *
 * Junction `landing_category_links(landing_slug, category_id, link_type,
 * sort_order, display_label)` populated в migration 20260606050000.
 *
 * Two query helpers:
 *   - `getRelatedLandings(categoryId)` — на category page, render «Готовые
 *     решения» block.
 *   - `getRelatedCategories(landingSlug)` — на landing page, render «Купить
 *     материалы» block.
 *
 * Both use anon-key Supabase client (RLS allows public read on the junction
 * table — content data, не PII).
 */

import { supabase } from '@/lib/supabase'
import { LANDINGS } from './index'
import type { LandingConfig } from './types'

export type LinkType = 'primary' | 'related' | 'material'

export interface RelatedLanding {
  slug: string
  config: LandingConfig
  displayLabel: string
  linkType: LinkType
  sortOrder: number
}

export interface RelatedCategory {
  id: string
  slug: string
  name: string
  productCount: number
  displayLabel: string
  linkType: LinkType
  sortOrder: number
}

/**
 * Returns landings linked к category (для cross-promotion на category page).
 * Sorted by `sort_order`. Filters out landings whose config is not registered
 * в `LANDINGS` (defensive — DB may have stale rows after landing removal).
 */
export async function getRelatedLandings(
  categoryId: string,
): Promise<RelatedLanding[]> {
  const { data, error } = await supabase
    .from('landing_category_links')
    .select('landing_slug, link_type, display_label, sort_order')
    .eq('category_id', categoryId)
    .order('sort_order')

  if (error || !data) return []

  const rows = data as Array<{
    landing_slug: string
    link_type: LinkType
    display_label: string | null
    sort_order: number
  }>

  const result: RelatedLanding[] = []
  for (const row of rows) {
    const config = LANDINGS[row.landing_slug]
    if (!config) continue
    result.push({
      slug: row.landing_slug,
      config,
      displayLabel: row.display_label ?? config.hero.h1,
      linkType: row.link_type,
      sortOrder: row.sort_order,
    })
  }
  return result
}

/**
 * Returns categories linked к landing (для «Купить материалы» block on
 * landing page). Joins categories table for slug + name; productCount fed
 * via existing `get_product_counts()` RPC (recursive — see migration
 * 20260526120000).
 */
export async function getRelatedCategories(
  landingSlug: string,
): Promise<RelatedCategory[]> {
  const { data, error } = await supabase
    .from('landing_category_links')
    .select(
      'link_type, display_label, sort_order, categories!inner(id, slug, name)',
    )
    .eq('landing_slug', landingSlug)
    .order('sort_order')

  if (error || !data) return []

  // Build set of category IDs to fetch counts only для needed
  type Row = {
    link_type: LinkType
    display_label: string | null
    sort_order: number
    categories: { id: string; slug: string; name: string }
  }
  const rows = data as unknown as Row[]
  const categoryIds = rows.map((r) => r.categories.id)

  // Get product counts (recursive RPC). RPC returns rows for ALL categories
  // — we filter в JS вместо .in() arg к RPC (which Supabase doesn't accept).
  const { data: counts } = await supabase.rpc('get_product_counts')
  const countMap = new Map<string, number>()
  if (Array.isArray(counts)) {
    for (const c of counts as Array<{ category_id: string; count: string | number }>) {
      if (categoryIds.includes(c.category_id)) {
        countMap.set(c.category_id, Number(c.count) || 0)
      }
    }
  }

  return rows.map((row) => ({
    id: row.categories.id,
    slug: row.categories.slug,
    name: row.categories.name,
    productCount: countMap.get(row.categories.id) ?? 0,
    displayLabel: row.display_label ?? row.categories.name,
    linkType: row.link_type,
    sortOrder: row.sort_order,
  }))
}

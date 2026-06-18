import { createClient } from '@supabase/supabase-js'
import { KanbanBoard } from './KanbanBoard'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

export default async function KanbanPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: leads } = await supabase
    .from('dream_leads')
    .select('id, slug, name, niche, phone, rating, reviews_count, build_status, photos_count, completeness_score, updated_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .order('updated_at', { ascending: false })

  // Подтянем счётчики: блокеры + лендинги
  const leadIds = (leads ?? []).map((l: any) => l.id)
  const [{ data: blockers }, { data: landings }, { data: comments }] = await Promise.all([
    supabase.from('dream_lead_blockers').select('lead_id').in('lead_id', leadIds.length ? leadIds : [-1]),
    supabase.from('dream_landings').select('lead_id, is_chosen').in('lead_id', leadIds.length ? leadIds : [-1]),
    supabase.from('dream_lead_comments').select('lead_id, kind, is_resolved').in('lead_id', leadIds.length ? leadIds : [-1]),
  ])

  const blockersByLead = new Set((blockers ?? []).map((b: any) => b.lead_id))
  const landingsByLead = new Map<number, { total: number; chosen: number }>()
  ;(landings ?? []).forEach((l: any) => {
    const v = landingsByLead.get(l.lead_id) ?? { total: 0, chosen: 0 }
    v.total++; if (l.is_chosen) v.chosen++
    landingsByLead.set(l.lead_id, v)
  })
  const commentsByLead = new Map<number, number>()
  ;(comments ?? []).forEach((c: any) => {
    if (!c.is_resolved) commentsByLead.set(c.lead_id, (commentsByLead.get(c.lead_id) ?? 0) + 1)
  })

  const enriched = (leads ?? []).map((l: any) => ({
    ...l,
    has_blocker: blockersByLead.has(l.id),
    landings_total: landingsByLead.get(l.id)?.total ?? 0,
    landings_chosen: landingsByLead.get(l.id)?.chosen ?? 0,
    comments_unresolved: commentsByLead.get(l.id) ?? 0,
  }))

  return <KanbanBoard leads={enriched} />
}

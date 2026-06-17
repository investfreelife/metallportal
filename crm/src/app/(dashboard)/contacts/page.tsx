import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/session'
import { ContactsClient } from './ContactsClient'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; segment?: string; q?: string }>
}) {
  const TENANT_ID = await getTenantId()
  const { filter, segment, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contacts')
    .select('*, deals(id, stage, amount)')
    .eq('tenant_id', TENANT_ID)
    .order('ai_score', { ascending: false })
    .limit(100)

  if (segment) query = query.eq('ai_segment', segment)
  if (filter === 'hot') query = query.gt('ai_score', 60)
  if (filter === 'dream') query = query.eq('source', 'dream_landing')
  if (q) query = query.or(
    `full_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`
  )

  const { data: contactsRaw } = await query
  const contacts = contactsRaw ?? []

  // Подтянем slug из dream_leads — чтобы клик вёл на карточку лендинг-фабрики
  const dreamContactIds = contacts.filter(c => c.source === 'dream_landing').map(c => c.id)
  let slugByContactId = new Map<string, string>()
  if (dreamContactIds.length > 0) {
    const { data: leads } = await supabase
      .from('dream_leads')
      .select('contact_id, slug')
      .in('contact_id', dreamContactIds)
    slugByContactId = new Map((leads ?? []).map((l: any) => [l.contact_id, l.slug]))
  }
  const enriched = contacts.map(c => ({
    ...c,
    dream_slug: c.source === 'dream_landing' ? (slugByContactId.get(c.id) ?? null) : null,
  }))

  const stats = {
    total: enriched.length,
    hot:   enriched.filter(c => (c.ai_score || 0) > 60).length,
    warm:  enriched.filter(c => (c.ai_score || 0) >= 30 && (c.ai_score || 0) <= 60).length,
    cold:  enriched.filter(c => (c.ai_score || 0) < 30).length,
    dream: enriched.filter(c => c.source === 'dream_landing').length,
  }

  return <ContactsClient contacts={enriched} stats={stats} />
}

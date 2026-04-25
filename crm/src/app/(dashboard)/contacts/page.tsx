import { createClient } from '@/lib/supabase/server'
import { ContactsClient } from './ContactsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; segment?: string; q?: string }>
}) {
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
  if (q) query = query.or(
    `full_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`
  )

  const { data: contacts } = await query

  const stats = {
    total: contacts?.length || 0,
    hot:  contacts?.filter(c => (c.ai_score || 0) > 60).length || 0,
    warm: contacts?.filter(c => (c.ai_score || 0) >= 30 && (c.ai_score || 0) <= 60).length || 0,
    cold: contacts?.filter(c => (c.ai_score || 0) < 30).length || 0,
  }

  return <ContactsClient contacts={contacts || []} stats={stats} />
}

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactDetail } from './ContactDetail'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: contact }, { data: deals }, { data: activities }, { data: siteEvents }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).eq('tenant_id', TENANT_ID).single(),
    supabase.from('deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    supabase.from('activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('site_events').select('event_type, url, utm_source, created_at, device')
      .eq('contact_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!contact) notFound()

  return <ContactDetail contact={contact} deals={deals || []} activities={activities || []} siteEvents={siteEvents || []} />
}

import { createClient } from '@/lib/supabase/server'
import ContactsClient from './ContactsClient'

export default async function ContactsPage() {
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      id, full_name, company_name, phone, email, type, status,
      ai_score, ai_segment, source, assigned_to, tags, created_at
    `)
    .order('created_at', { ascending: false })

  return <ContactsClient contacts={contacts ?? []} />
}

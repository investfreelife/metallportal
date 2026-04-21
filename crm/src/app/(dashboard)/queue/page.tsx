import { createClient } from '@/lib/supabase/server'
import QueueClient from './QueueClient'

export default async function QueuePage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('ai_queue')
    .select(`
      *,
      contact:contacts(id, full_name, company_name, phone, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return <QueueClient items={items ?? []} />
}

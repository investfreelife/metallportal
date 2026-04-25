import { createClient } from '@/lib/supabase/server'
import { QueueClient } from './QueueClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function QueuePage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('ai_queue')
    .select('*, contacts(full_name, company_name, phone)')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(50)

  const stats = {
    pending: items?.filter(i => i.status === 'pending').length || 0,
    approved: items?.filter(i => i.status === 'approved').length || 0,
    total: items?.length || 0,
  }

  return <QueueClient items={items || []} stats={stats} />
}

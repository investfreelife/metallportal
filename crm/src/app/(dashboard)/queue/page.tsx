import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/session'
import { QueueClient } from './QueueClient'

export default async function QueuePage() {
  const TENANT_ID = await getTenantId()
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

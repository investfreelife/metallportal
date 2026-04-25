import { createClient } from '@/lib/supabase/server'
import { DealsClient } from './DealsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function DealsPage() {
  const supabase = await createClient()

  const [{ data: deals }, { data: lostDeals }] = await Promise.all([
    supabase
      .from('deals')
      .select('*, contacts(full_name, company_name, phone)')
      .eq('tenant_id', TENANT_ID)
      .not('stage', 'eq', 'lost')
      .order('created_at', { ascending: false }),
    supabase
      .from('deals')
      .select('*, contacts(full_name, company_name)')
      .eq('tenant_id', TENANT_ID)
      .eq('stage', 'lost')
      .order('updated_at', { ascending: false })
      .limit(20),
  ])

  return <DealsClient deals={deals || []} lostDeals={lostDeals || []} />
}

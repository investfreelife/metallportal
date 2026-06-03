import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/session'
import { BezosPage } from './BezosPage'

export default async function Page() {
  const TENANT_ID = await getTenantId()
  const supabase = await createClient()

  const [
    { data: cycles },
    { data: actions },
    { data: memory },
  ] = await Promise.all([
    supabase.from('agent_cycles').select('*')
      .eq('tenant_id', TENANT_ID)
      .order('started_at', { ascending: false }).limit(50),
    supabase.from('agent_actions').select('*')
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('agent_memory').select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('agent_name', 'bezos')
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false }).limit(20),
  ])

  return <BezosPage cycles={cycles||[]} actions={actions||[]} memory={memory||[]} />
}

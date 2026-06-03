import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/session'
import { ChannelsClient } from './ChannelsClient'

export default async function ChannelsPage() {
  const TENANT_ID = await getTenantId()
  const supabase = await createClient()
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('status')

  return <ChannelsClient initialChannels={channels || []} />
}

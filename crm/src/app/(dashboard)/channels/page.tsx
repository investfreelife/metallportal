import { createClient } from '@/lib/supabase/server'
import { ChannelsClient } from './ChannelsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function ChannelsPage() {
  const supabase = await createClient()
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('status')

  return <ChannelsClient initialChannels={channels || []} />
}

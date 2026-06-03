import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/session'
import { CampaignsClient } from './CampaignsClient'

export default async function CampaignsPage() {
  const TENANT_ID = await getTenantId()
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('social_posts')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(20)

  return <CampaignsClient posts={posts || []} />
}

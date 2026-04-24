import { createClient } from '@/lib/supabase/server'
import { CampaignsClient } from './CampaignsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('social_posts')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(20)

  return <CampaignsClient posts={posts || []} />
}

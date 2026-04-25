import { createClient } from '@/lib/supabase/server'
import { BezosChat } from './BezosChat'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function BezosPage() {
  const supabase = await createClient()

  const { data: history } = await supabase
    .from('ai_queue')
    .select('id, subject, content, created_at, status')
    .eq('tenant_id', TENANT_ID)
    .like('subject', '%Безос%')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: metrics } = await supabase
    .from('contacts')
    .select('ai_score, ai_segment')
    .eq('tenant_id', TENANT_ID)

  const hotCount = metrics?.filter(c => (c.ai_score || 0) >= 70).length || 0
  const warmCount = metrics?.filter(c => (c.ai_score || 0) >= 40 && (c.ai_score || 0) < 70).length || 0
  const totalContacts = metrics?.length || 0

  return (
    <BezosChat
      lastReport={history?.[0] || null}
      history={history || []}
      quickStats={{ hotCount, warmCount, totalContacts }}
    />
  )
}

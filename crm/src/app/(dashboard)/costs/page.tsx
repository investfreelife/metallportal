import { createClient } from '@/lib/supabase/server'
import { CostsDashboard } from './CostsDashboard'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function CostsPage() {
  const supabase = await createClient()

  let balance: any = null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      next: { revalidate: 60 },
    })
    if (res.ok) {
      const data = await res.json()
      balance = data.data
    }
  } catch {}

  const { data: logs } = await supabase
    .from('ai_cost_log')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: byAgent } = await supabase
    .from('ai_cost_log')
    .select('agent_name, total_cost_usd, total_tokens')
    .eq('tenant_id', TENANT_ID)

  return (
    <CostsDashboard
      logs={logs || []}
      balance={balance}
      rawByAgent={byAgent || []}
    />
  )
}

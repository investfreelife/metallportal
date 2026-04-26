import { createClient } from '@/lib/supabase/server'
import { CostsClient } from './CostsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function CostsPage() {
  const supabase = await createClient()

  let balance = null
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

  const { data: costs } = await supabase
    .from('ai_costs')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(200)

  return <CostsClient balance={balance} costs={costs || []} />
}

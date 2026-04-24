import { createClient } from '@/lib/supabase/server'
import { CallsClient } from './CallsClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function CallsPage() {
  const supabase = await createClient()
  const { data: calls } = await supabase
    .from('calls')
    .select('*, contacts(full_name, company_name, phone)')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(50)

  const safeC = calls || []
  const stats = {
    total: safeC.length,
    completed: safeC.filter((c: any) => c.status === 'completed').length,
    avgDuration: Math.round(
      (safeC.filter((c: any) => c.duration).reduce((s: number, c: any) => s + c.duration, 0) || 0) /
      (safeC.filter((c: any) => c.duration).length || 1) / 60
    ),
    avgScore: Math.round(
      (safeC.filter((c: any) => c.ai_quality_score).reduce((s: number, c: any) => s + c.ai_quality_score, 0) || 0) /
      (safeC.filter((c: any) => c.ai_quality_score).length || 1)
    ),
  }

  return <CallsClient calls={safeC} stats={stats} />
}

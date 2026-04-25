import { createClient } from '@/lib/supabase/server'
import { ReferralAdmin } from './ReferralAdmin'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function ReferralPage() {
  const supabase = await createClient()

  const [{ data: partners }, { data: transactions }] = await Promise.all([
    supabase.from('referral_partners').select('*').eq('tenant_id', TENANT_ID).order('total_earned', { ascending: false }),
    supabase.from('referral_transactions').select('*').eq('tenant_id', TENANT_ID).eq('status', 'pending').order('created_at', { ascending: false }),
  ])

  const stats = {
    totalPartners: partners?.length || 0,
    activePartners: partners?.filter(p => p.active_referrals > 0).length || 0,
    totalPending: transactions?.reduce((s, t) => s + Number(t.amount), 0) || 0,
    totalPaid: partners?.reduce((s, p) => s + Number(p.total_paid), 0) || 0,
  }

  return <ReferralAdmin partners={partners || []} pendingTx={transactions || []} stats={stats} />
}

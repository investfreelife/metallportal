import { createClient } from '@/lib/supabase/server'
import { ReferralAdmin } from './ReferralAdmin'
import { ReferralAdminClient } from './ReferralAdminClient'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export default async function ReferralPage() {
  const supabase = await createClient()

  const [{ data: partners }, { data: transactions }, { data: siteUsers }, { data: siteTx }] = await Promise.all([
    supabase.from('referral_partners').select('*').eq('tenant_id', TENANT_ID).order('total_earned', { ascending: false }),
    supabase.from('referral_transactions').select('*').eq('tenant_id', TENANT_ID).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('site_users').select('id, full_name, company_name, email, ref_code, referred_by, total_orders, total_amount, created_at').eq('tenant_id', TENANT_ID).not('ref_code', 'is', null).order('total_amount', { ascending: false }).limit(100),
    supabase.from('referral_transactions').select('*').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(50),
  ])

  const stats = {
    totalPartners: partners?.length || 0,
    activePartners: partners?.filter(p => p.active_referrals > 0).length || 0,
    totalPending: transactions?.reduce((s, t) => s + Number(t.amount), 0) || 0,
    totalPaid: partners?.reduce((s, p) => s + Number(p.total_paid), 0) || 0,
  }

  const siteStats = {
    totalPartners: siteUsers?.length || 0,
    activePartners: siteUsers?.filter(u => u.total_orders > 0).length || 0,
    totalReferrals: siteUsers?.filter(u => u.referred_by).length || 0,
    pendingPayout: (siteTx || []).filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0),
  }

  return (
    <div>
      {/* Партнёры сайта (новая система) */}
      {(siteUsers?.length ?? 0) > 0 && (
        <ReferralAdminClient users={siteUsers || []} transactions={siteTx || []} stats={siteStats} />
      )}
      {/* Старая система партнёров */}
      {(partners?.length ?? 0) > 0 && (
        <div className="mt-6">
          <div className="px-4 mb-2 text-[11px] text-gray-500 font-medium">Партнёры (старая схема)</div>
          <ReferralAdmin partners={partners || []} pendingTx={transactions || []} stats={stats} />
        </div>
      )}
      {(siteUsers?.length ?? 0) === 0 && (partners?.length ?? 0) === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm">
          Партнёров пока нет. SQL таблица site_users должна быть создана.
        </div>
      )}
    </div>
  )
}

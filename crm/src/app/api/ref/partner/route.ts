import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Admin partner-lookup — owner only (exposes partner data).
  const auth = requireRole(req, ['owner', 'admin'])
  if (!auth.ok) return auth.error

  const code = req.nextUrl.searchParams.get('code')
  const email = req.nextUrl.searchParams.get('email')

  if (!code && !email) return NextResponse.json({ error: 'code или email обязательны' }, { status: 400 })

  let query = supabase.from('referral_partners').select('*')
  if (code) query = query.eq('ref_code', code.toUpperCase())
  else if (email) query = query.eq('email', email)

  const { data: partner } = await query.single()
  if (!partner) return NextResponse.json({ error: 'Не найден' }, { status: 404 })

  const [{ data: referrals }, { data: transactions }, { data: payouts }] = await Promise.all([
    supabase.from('referrals').select('*').eq('partner_id', partner.id).order('registered_at', { ascending: false }),
    supabase.from('referral_transactions').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('referral_payouts').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({ partner, referrals: referrals || [], transactions: transactions || [], payouts: payouts || [] })
}

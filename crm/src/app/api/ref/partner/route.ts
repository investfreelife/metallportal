import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * PUBLIC BY DESIGN: partner portal data endpoint.
 *
 * The `code` (ref_code, 16+ uppercase chars from join token) or `email`
 * query param acts as a shared-secret for the partner's own dashboard.
 * Rate-limited per-IP to mitigate guessing.
 *
 * TODO: replace with proper partner-token cookie auth — see backlog
 * ТЗ c011_partner-portal-proper-auth-flow.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  if (!(await checkRateLimit(req, 'ref-partner', 30, 60_000))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

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

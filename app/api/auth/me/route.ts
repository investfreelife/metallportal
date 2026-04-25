import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_session')?.value
  if (!userId) return NextResponse.json({ user: null })

  const { data: user } = await supabase
    .from('site_users')
    .select('id, email, full_name, company_name, phone, ref_code, total_orders, total_amount, created_at')
    .eq('id', userId)
    .single()

  if (!user) return NextResponse.json({ user: null })

  const { data: referrals } = await supabase
    .from('site_users')
    .select('id, full_name, company_name, created_at, total_orders, total_amount')
    .eq('referred_by', userId)

  return NextResponse.json({ user, referrals: referrals || [] })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // PUBLIC BY DESIGN: partner referral signup — rate-limited.
  if (!(await checkRateLimit(req, 'ref-register', 30, 60_000))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { ref_code, contact_id, name, email, company, source } = await req.json()

  if (!ref_code) return NextResponse.json({ ok: false, error: 'Нет ref_code' })

  const { data: partner } = await supabase
    .from('referral_partners')
    .select('id, tenant_id, active_referrals, total_referrals')
    .eq('ref_code', ref_code.toUpperCase())
    .single()

  if (!partner) return NextResponse.json({ ok: false, error: 'Партнёр не найден' })

  const { data: referral } = await supabase
    .from('referrals')
    .insert({
      tenant_id: partner.tenant_id,
      partner_id: partner.id,
      contact_id: contact_id || null,
      ref_name: name,
      ref_email: email,
      ref_company: company,
      ref_code: ref_code.toUpperCase(),
      source: source || 'direct',
    })
    .select()
    .single()

  await supabase.from('referral_partners').update({
    total_referrals: partner.total_referrals + 1,
    active_referrals: partner.active_referrals + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', partner.id)

  await supabase.rpc('update_partner_level', { p_partner_id: partner.id })

  return NextResponse.json({ ok: true, referral_id: referral?.id })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // PUBLIC BY DESIGN: referral tracking redirect — rate-limited.
  if (!(await checkRateLimit(req, 'ref-track', 60, 60_000))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const code = req.nextUrl.searchParams.get('code')
  const redirectTo = req.nextUrl.searchParams.get('to') || 'https://metallportal.vercel.app'

  if (!code) return NextResponse.redirect(redirectTo)

  const { data: partner } = await supabase
    .from('referral_partners')
    .select('id, tenant_id, ref_code, status')
    .eq('ref_code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!partner) return NextResponse.redirect(redirectTo)

  await supabase.from('site_events').insert({
    tenant_id: partner.tenant_id,
    event_type: 'referral_click',
    event_data: { ref_code: code, partner_id: partner.id },
    utm_source: `ref_${code.toLowerCase()}`,
    url: '/ref',
  })

  const response = NextResponse.redirect(redirectTo)
  response.cookies.set('ref_code', code.toUpperCase(), {
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: false,
    path: '/',
  })
  return response
}

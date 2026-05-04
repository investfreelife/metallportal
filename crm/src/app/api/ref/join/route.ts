import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

function generateCode(name: string): string {
  const base = name.toUpperCase().replace(/[^A-ZА-ЯЁ]/gi, '').substring(0, 6)
  const year = new Date().getFullYear().toString().slice(-2)
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase()
  return `${base}${year}${suffix}`
}

export async function POST(req: NextRequest) {
  // PUBLIC BY DESIGN: partner-program signup — rate-limited.
  if (!checkRateLimit(req, 'ref-join', 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { full_name, email, phone, company } = await req.json()

  if (!full_name || !email) return NextResponse.json({ error: 'Имя и email обязательны' }, { status: 400 })

  const { data: existing } = await supabase.from('referral_partners').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: 'Этот email уже зарегистрирован' }, { status: 400 })

  let ref_code = generateCode(full_name)
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await supabase.from('referral_partners').select('id').eq('ref_code', ref_code).single()
    if (!exists) break
    ref_code = generateCode(full_name)
  }

  const { data: partner, error } = await supabase
    .from('referral_partners')
    .insert({ tenant_id: TENANT_ID, full_name, email, phone, company, ref_code, level: 'bronze', commission_rate: 2.00 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ partner, ref_code })
}

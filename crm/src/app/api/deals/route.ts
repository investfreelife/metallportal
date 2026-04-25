import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { title, amount, stage, contact_id, expected_close_date } = await req.json()
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const supabase = getSupabase()
    const { data, error } = await supabase.from('deals').insert({
      tenant_id: TENANT_ID,
      title,
      amount: amount ? Number(amount) : null,
      stage: stage ?? 'new',
      contact_id: contact_id ?? null,
      expected_close_date: expected_close_date ?? null,
      ai_win_probability: 0,
    }).select('*, contacts(full_name, company_name, phone)').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data?.id, deal: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

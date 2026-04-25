import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = getSupabase()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.items !== undefined) {
    update.items = body.items
    if (Array.isArray(body.items)) {
      const total = body.items.reduce((s: number, it: { total?: number; price?: number; qty?: number }) =>
        s + (it.total ?? (it.price ?? 0) * (it.qty ?? 1)), 0)
      if (total > 0) update.amount = total
    }
  }
  const allowedFields = ['stage','title','amount','suppliers','customer_notified',
    'expected_close_date','ai_win_probability','lost_reason','ai_recommendation','contact_id']
  for (const f of allowedFields) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  const { data, error } = await supabase.from('deals').update(update).eq('id', id)
    .select('*, contacts(full_name, company_name, phone)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deal: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

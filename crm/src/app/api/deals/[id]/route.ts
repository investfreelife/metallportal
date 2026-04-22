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

  const update: Record<string, unknown> = {}
  if (body.items !== undefined) {
    update.items = body.items
    // recalculate amount from items
    if (Array.isArray(body.items)) {
      const total = body.items.reduce((s: number, it: { total?: number; price?: number; qty?: number }) =>
        s + (it.total ?? (it.price ?? 0) * (it.qty ?? 1)), 0)
      if (total > 0) update.amount = total
    }
  }
  if (body.stage !== undefined) update.stage = body.stage
  if (body.title !== undefined) update.title = body.title
  if (body.amount !== undefined) update.amount = body.amount

  const { error } = await supabase.from('deals').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const CLOSED = ['won', 'delivery', 'completed', 'lost']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contactId } = await params
  const supabase = getSupabase()

  // 1. Get all open deals for this contact, newest first
  const { data: deals, error } = await supabase
    .from('deals')
    .select('id, title, amount, stage, items, created_at')
    .eq('contact_id', contactId)
    .not('stage', 'in', `(${CLOSED.join(',')})`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deals || deals.length < 2) {
    return NextResponse.json({ ok: false, message: 'Меньше двух открытых сделок — нечего объединять' })
  }

  // 2. Keep the newest deal as the target; merge all others into it
  const [target, ...rest] = deals

  // Merge items from all deals into target
  const mergedItems: Array<{ id: string; name: string; qty: number; unit: string; price: number; total: number }> =
    Array.isArray(target.items) ? [...target.items] : []

  for (const deal of rest) {
    if (!Array.isArray(deal.items)) continue
    for (const newItem of deal.items) {
      const exists = mergedItems.find(
        (it) => it.name?.trim() === newItem.name?.trim() && it.unit === newItem.unit
      )
      if (exists) {
        exists.qty = (exists.qty || 0) + (newItem.qty || 0)
        const unitPrice = exists.price || newItem.price || 0
        if (unitPrice > 0) {
          exists.total = Math.round(unitPrice * exists.qty)
        } else {
          exists.total = (exists.total ?? 0) + (newItem.total ?? 0)
        }
      } else {
        mergedItems.push({ ...newItem })
      }
    }
  }

  const totalAmount = mergedItems.reduce((s, it) => s + (it.total ?? 0), 0) ||
    deals.reduce((s: number, d: { amount?: number }) => s + (d.amount ?? 0), 0)

  // 3. Update target deal with merged data
  await supabase.from('deals').update({
    items: mergedItems,
    amount: Math.round(totalAmount) || null,
    title: target.title,
  }).eq('id', target.id)

  // 4. Re-link tasks and activities from merged deals to target
  const mergedIds = rest.map((d: { id: string }) => d.id)
  if (mergedIds.length > 0) {
    await supabase.from('tasks').update({ deal_id: target.id }).in('deal_id', mergedIds)
    await supabase.from('activities').update({ deal_id: target.id }).in('deal_id', mergedIds)
  }

  // 5. Delete the merged deals
  const { error: delErr } = await supabase.from('deals').delete().in('id', mergedIds)
  if (delErr) return NextResponse.json({ error: `Ошибка удаления: ${delErr.message}` }, { status: 500 })

  return NextResponse.json({
    ok: true,
    message: `Объединено ${deals.length} сделок → 1. Итого: ${Math.round(totalAmount).toLocaleString('ru')} ₽`,
    targetId: target.id,
    merged: mergedIds.length,
  })
}

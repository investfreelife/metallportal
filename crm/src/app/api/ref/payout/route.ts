import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { partner_id, bank_card, bank_name } = await req.json()

  const { data: partner } = await supabase.from('referral_partners').select('*').eq('id', partner_id).single()
  if (!partner || Number(partner.pending_amount) < 500) {
    return NextResponse.json({ error: 'Минимальная сумма выплаты 500 ₽' }, { status: 400 })
  }

  const { data: pendingTx } = await supabase
    .from('referral_transactions')
    .select('id')
    .eq('partner_id', partner_id)
    .eq('status', 'pending')

  const txIds = pendingTx?.map((t: any) => t.id) || []

  await supabase.from('referral_payouts').insert({
    tenant_id: partner.tenant_id,
    partner_id,
    amount: partner.pending_amount,
    bank_card: bank_card || partner.bank_card,
    bank_name: bank_name || partner.bank_name,
    status: 'processing',
    transaction_ids: txIds,
  })

  await supabase.from('referral_transactions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('partner_id', partner_id)
    .eq('status', 'pending')

  await supabase.from('referral_partners').update({
    total_paid: Number(partner.total_paid) + Number(partner.pending_amount),
    pending_amount: 0,
    bank_card: bank_card || partner.bank_card,
    bank_name: bank_name || partner.bank_name,
    updated_at: new Date().toISOString(),
  }).eq('id', partner_id)

  return NextResponse.json({ ok: true, amount: partner.pending_amount })
}

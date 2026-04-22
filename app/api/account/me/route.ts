import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mp_session')?.value
  if (!token) return NextResponse.json({ user: null })

  const supabase = getSupabase()

  const { data: session } = await supabase.from('contact_sessions')
    .select('contact_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ user: null })
  }

  const { data: contact } = await supabase.from('contacts')
    .select('id, full_name, phone, email, telegram_chat_id, ai_score, created_at')
    .eq('id', session.contact_id)
    .eq('tenant_id', TENANT_ID)
    .single()

  if (!contact) return NextResponse.json({ user: null })

  // Get orders
  const { data: orders } = await supabase.from('orders')
    .select('id, status, items, created_at, customer_name')
    .eq('customer_phone', contact.phone ?? '')
    .order('created_at', { ascending: false })
    .limit(20)

  // Get deals
  const { data: deals } = await supabase.from('deals')
    .select('id, title, amount, stage, created_at')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ user: contact, orders: orders ?? [], deals: deals ?? [] })
}

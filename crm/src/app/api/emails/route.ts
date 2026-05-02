import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { searchParams } = new URL(req.url)
  const deal_id = searchParams.get('deal_id')
  const contact_id = searchParams.get('contact_id')
  const account_id = searchParams.get('account_id')
  const unread = searchParams.get('unread')
  const page = parseInt(searchParams.get('page') ?? '0')
  const limit = 50

  const supabase = getSupabase()
  let q = supabase.from('emails')
    .select('id, direction, from_email, from_name, to_emails, subject, body_text, is_read, is_starred, received_at, sent_at, deal_id, contact_id, account_id, thread_id, created_at')
    .eq('tenant_id', TENANT_ID)
    .order('received_at', { ascending: false, nullsFirst: false })
    .order('sent_at', { ascending: false, nullsFirst: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (deal_id) q = q.eq('deal_id', deal_id)
  if (contact_id) q = q.eq('contact_id', contact_id)
  if (account_id) q = q.eq('account_id', account_id)
  if (unread === '1') q = q.eq('is_read', false)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { id, is_read, is_starred, deal_id, contact_id } = await req.json()
  const supabase = getSupabase()

  const update: Record<string, unknown> = {}
  if (is_read !== undefined) update.is_read = is_read
  if (is_starred !== undefined) update.is_starred = is_starred
  if (deal_id !== undefined) update.deal_id = deal_id
  if (contact_id !== undefined) update.contact_id = contact_id

  const { error } = await supabase.from('emails').update(update).eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

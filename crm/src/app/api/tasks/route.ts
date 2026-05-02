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

export async function POST(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  try {
    const { deal_id, contact_id, title, body, priority, due_at } = await req.json()
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const supabase = getSupabase()
    const { data: task, error } = await supabase.from('tasks').insert({
      tenant_id: TENANT_ID,
      deal_id: deal_id ?? null,
      contact_id: contact_id ?? null,
      title,
      body: body ?? null,
      priority: priority ?? 'normal',
      due_at: due_at ?? null,
      status: 'pending',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, task })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const dealId = new URL(req.url).searchParams.get('deal_id')
  const supabase = getSupabase()
  const query = supabase.from('tasks').select('*').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false })
  if (dealId) query.eq('deal_id', dealId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

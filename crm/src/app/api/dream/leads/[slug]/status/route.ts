import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const ALLOWED = new Set(['new', 'enriched', 'generated', 'outreach', 'contacted', 'hot', 'proposal', 'won', 'lost', 'wont_do'])

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const status = String(body.status || '')
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: 'invalid_status', allowed: [...ALLOWED] }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase
    .from('dream_leads')
    .update({ status })
    .eq('tenant_id', DREAM_TENANT_ID)
    .eq('slug', slug)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lead: data })
}

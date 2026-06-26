import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: lead, error: leadErr } = await supabase
    .from('dream_leads')
    .select('id')
    .eq('tenant_id', DREAM_TENANT_ID)
    .eq('slug', slug)
    .maybeSingle()

  if (leadErr || !lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const { error } = await supabase.from('dream_activities').insert({
    lead_id: lead.id,
    type: String(body.type || 'note'),
    direction: body.direction || 'outbound',
    channel: body.channel,
    subject: body.subject,
    body: body.body,
    metadata: body.metadata || {},
    created_by: body.created_by || 'sergey',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If channel is outreach-y, bump status to 'outreach' or 'contacted'
  if (['whatsapp', 'telegram', 'call', 'email'].includes(String(body.type)) && body.bump_status) {
    await supabase
      .from('dream_leads')
      .update({ status: body.bump_status })
      .eq('id', lead.id)
  }

  return NextResponse.json({ ok: true })
}

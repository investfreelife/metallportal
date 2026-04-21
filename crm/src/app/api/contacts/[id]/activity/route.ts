import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contact_id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { type = 'note', subject, body } = await request.json()

  const { error } = await supabase.from('activities').insert({
    tenant_id: TENANT_ID,
    contact_id,
    type,
    direction: 'outbound',
    subject: subject || null,
    body: body || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

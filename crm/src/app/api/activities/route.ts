import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { getTenantIdFromRequest } from '@/lib/session'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const TENANT_ID = getTenantIdFromRequest(req)
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const body = await req.json()
  const { contact_id, deal_id, type, subject, body: text, direction } = body

  if (!contact_id && !deal_id) {
    return NextResponse.json({ error: 'contact_id или deal_id обязателен' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.from('activities').insert({
    tenant_id: TENANT_ID,
    contact_id: contact_id || null,
    deal_id: deal_id || null,
    type: type || 'note',
    subject: subject || null,
    body: text || null,
    direction: direction || null,
    is_ai_generated: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data })
}

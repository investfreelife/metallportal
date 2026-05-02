import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

/**
 * POST /api/contacts
 * Create a new contact manually from CRM
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if (!auth.ok) return auth.error

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.json()
  const { full_name, company_name, phone, email, source, notes, type = 'person' } = body

  if (!full_name && !phone && !email) {
    return NextResponse.json({ error: 'Нужно хотя бы имя, телефон или email' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      tenant_id: TENANT_ID,
      full_name: full_name || null,
      company_name: company_name || null,
      phone: phone || null,
      email: email || null,
      source: source || 'manual',
      notes: notes || null,
      type,
      status: 'new',
      ai_score: 10,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data, id: data.id })
}

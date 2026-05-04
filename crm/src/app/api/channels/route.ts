import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/apiAuth'
import { createClient } from '@/lib/supabase/server'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export async function GET(req: import('next/server').NextRequest) {
  const auth = requireRole(req, ['owner', 'manager', 'admin'])
  if (!auth.ok) return auth.error

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('status', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channels: data || [] })
}

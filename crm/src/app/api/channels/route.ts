import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/apiAuth'
import { getTenantIdFromRequest } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: import('next/server').NextRequest) {
  const TENANT_ID = getTenantIdFromRequest(req)
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

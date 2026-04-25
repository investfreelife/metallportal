import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q) return NextResponse.json({ contacts: [] })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, company_name, phone')
    .eq('tenant_id', TENANT_ID)
    .or(`full_name.ilike.%${q}%,company_name.ilike.%${q}%`)
    .limit(5)

  return NextResponse.json({ contacts: data || [] })
}

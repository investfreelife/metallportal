import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

/**
 * GET /api/tenants/list — список всех тенантов для superadmin'ого dropdown.
 * Sergey directive 2026-06-17 (вариант B).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ tenants: [] })

  // Не-superadmin видит только свой тенант (для UI consistency)
  if (!session.is_superadmin) {
    return NextResponse.json({
      tenants: session.tenant
        ? [{ id: session.tenant, name: session.tenant_name ?? '—', industry: session.industry ?? 'metal' }]
        : [],
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('tenants')
    .select('id, name, industry')
    .order('name')

  return NextResponse.json({ tenants: data ?? [], active: session.tenant })
}

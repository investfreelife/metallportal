import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession, signSession } from '@/lib/session'

/**
 * POST /api/auth/switch-tenant — superadmin switches active tenant.
 *
 * Body: { tenant_id: uuid }
 *
 * Подменяет session cookie на новую с другим tenant/industry/tenant_name.
 * Сохраняет login/name/role/is_superadmin. Sergey directive 2026-06-17 —
 * глубокая интеграция Мечты (вариант B).
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!session.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden — superadmin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const tenantId: string | undefined = body?.tenant_id
  if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, industry')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 })

  const newSession = {
    login: session.login,
    name: session.name,
    role: session.role,
    tenant: tenant.id,
    industry: tenant.industry,
    tenant_name: tenant.name,
    is_superadmin: true,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }

  const token = signSession(newSession)

  const response = NextResponse.json({
    ok: true,
    tenant: { id: tenant.id, name: tenant.name, industry: tenant.industry },
  })
  response.cookies.set('crm_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })
  return response
}

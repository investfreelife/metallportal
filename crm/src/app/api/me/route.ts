import { NextResponse } from 'next/server'
import { getSession, getTenantId } from '@/lib/session'

/**
 * GET /api/me
 *
 * Returns current authenticated user info. Used by client components
 * вместо хардкода `process.env.TENANT_ID || 'a1000000-...-001'`:
 *   const { tenant } = await fetch('/api/me').then(r => r.json())
 *
 * Multi-tenant 2026-06-03 — tenant читается из подписанной cookie session.
 * Если cookie нет → 401 (NOT публичный fallback к DEFAULT_TENANT_ID т.к.
 * client component без auth не имеет права читать чужие данные).
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // tenant либо из session либо из process.env override либо DEFAULT
  const tenant = session.tenant || (await getTenantId())
  return NextResponse.json({
    tenant,
    login: session.login,
    name: session.name,
    role: session.role,
  })
}

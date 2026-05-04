import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  // Idempotent — returning 200 is fine even when user has no session,
  // but require a valid session to prevent unauthenticated callers from
  // poking at this endpoint.
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const response = NextResponse.json({ ok: true })
  response.cookies.set('crm_session', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
  return response
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, CrmSession } from './session'

type AuthResult =
  | { ok: true; session: CrmSession; error?: undefined }
  | { ok: false; session?: undefined; error: NextResponse }

/**
 * Call at the top of any protected API route handler.
 * Usage:
 *   const auth = requireSession(request)
 *   if (!auth.ok) return auth.error
 *   const { session } = auth
 */
export function requireSession(request: NextRequest): AuthResult {
  const cookieHeader = request.headers.get('cookie')
  const session = getSessionFromRequest(cookieHeader)
  if (!session) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, session }
}

/**
 * Require admin role.
 */
export function requireAdmin(request: NextRequest): AuthResult {
  const result = requireSession(request)
  if (!result.ok) return result
  if (result.session.role !== 'admin') {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}

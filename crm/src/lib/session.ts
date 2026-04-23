import { cookies } from 'next/headers'
import crypto from 'crypto'

export interface CrmSession {
  login: string
  name: string
  role: string
  exp: number
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] SESSION_SECRET not set in production!')
  }
  return s || 'dev-only-insecure-secret-CHANGE-IN-PRODUCTION'
}

/** Sign payload with HMAC-SHA256 → payload.sig (base64url) */
export function signSession(data: CrmSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** Verify HMAC signature + expiry. Returns null on ANY failure. */
export function verifySession(token: string | undefined | null): CrmSession | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null  // reject legacy unsigned tokens

  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  // Timing-safe comparison to prevent signature oracle attacks
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null  // different lengths also means invalid
  }

  try {
    const session: CrmSession = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!session.exp || session.exp < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export async function getSession(): Promise<CrmSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('crm_session')?.value
  return verifySession(raw)
}

export function getSessionFromRequest(cookieHeader: string | null): CrmSession | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/crm_session=([^;]+)/)
  return verifySession(match?.[1])
}

/** @deprecated alias for old name */
export const getSessionFromCookieString = getSessionFromRequest

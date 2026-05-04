import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSessionFromRequest, CrmSession } from './session'

type AuthResult =
  | { ok: true; session: CrmSession; error?: undefined }
  | { ok: false; session?: undefined; error: NextResponse }

type WebhookAuthResult =
  | { ok: true; body: string; error?: undefined }
  | { ok: false; body?: undefined; error: NextResponse }

type SecretAuthResult =
  | { ok: true; error?: undefined }
  | { ok: false; error: NextResponse }

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
 * @deprecated prefer `requireRole(['owner'])`. Kept for backward compatibility:
 * legacy `admin_users.role = 'admin'` deployments still rely on this string.
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

/**
 * Granular role-based access (lesson 048).
 * Accepts any role string — CrmSession.role is `string` (read from `admin_users`),
 * which may include legacy values like 'admin' alongside 'owner'/'manager'/'viewer'.
 *
 * Usage:
 *   const auth = requireRole(req, ['owner', 'manager'])
 *   if (!auth.ok) return auth.error
 *   const { session } = auth
 */
export function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): AuthResult {
  const result = requireSession(request)
  if (!result.ok) return result
  if (!allowedRoles.includes(result.session.role)) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}

/**
 * Webhook signature verification (HMAC-SHA256 of raw body using secret in env).
 * Reads the request body once — caller MUST use the returned body string instead
 * of `request.text()`/`.json()` again (body stream is consumed here).
 *
 * Sender must include header `x-webhook-signature: <hex>`
 *   where hex = HMAC-SHA256(secret, rawBody) as hex.
 *
 * Usage:
 *   const auth = await requireWebhookSignature(req, 'WEBHOOK_SECRET_KEY')
 *   if (!auth.ok) return auth.error
 *   const data = JSON.parse(auth.body)
 */
export async function requireWebhookSignature(
  request: NextRequest,
  secretEnvKey: string
): Promise<WebhookAuthResult> {
  const secret = process.env[secretEnvKey]
  if (!secret) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Misconfigured' }, { status: 500 }),
    }
  }
  const sigHeader = request.headers.get('x-webhook-signature')
  if (!sigHeader) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Missing signature' }, { status: 401 }),
    }
  }
  const body = await request.text()
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  try {
    const a = Buffer.from(sigHeader, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {
        ok: false,
        error: NextResponse.json({ error: 'Invalid signature' }, { status: 401 }),
      }
    }
  } catch {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Invalid signature' }, { status: 401 }),
    }
  }
  return { ok: true, body }
}

/**
 * Cron-secret header verification (for Vercel Cron / external schedulers).
 * Accepts either `X-Cron-Secret: <secret>` or `Authorization: Bearer <secret>`.
 *
 * Usage:
 *   const auth = requireCronSecret(req)
 *   if (!auth.ok) return auth.error
 */
export function requireCronSecret(request: NextRequest): SecretAuthResult {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Misconfigured' }, { status: 500 }),
    }
  }
  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer /, '') ??
    null
  if (!provided) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  // Timing-safe compare
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true }
}

/**
 * Generic shared-secret header verification.
 * For external monitor / health-check endpoints not covered by cron-secret.
 * Header: `X-<envKeyHeader>` or `Authorization: Bearer <secret>`.
 *
 * Usage:
 *   const auth = requireSharedSecret(req, 'MONITOR_SECRET', 'x-monitor-secret')
 *   if (!auth.ok) return auth.error
 */
export function requireSharedSecret(
  request: NextRequest,
  secretEnvKey: string,
  headerName: string
): SecretAuthResult {
  const secret = process.env[secretEnvKey]
  if (!secret) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Misconfigured' }, { status: 500 }),
    }
  }
  const provided =
    request.headers.get(headerName) ??
    request.headers.get('authorization')?.replace(/^Bearer /, '') ??
    null
  if (!provided) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true }
}

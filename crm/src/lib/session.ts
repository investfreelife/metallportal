import { cookies } from 'next/headers'
import crypto from 'crypto'

export interface CrmSession {
  login: string
  name: string
  role: string
  /**
   * Multi-tenant identifier — UUID из admin_users.tenant_id. Опциональное:
   * старые подписанные cookies без этого поля валидны, есть фоллбэк ниже.
   *
   * Foundation per Sergey directive 2026-06-03 — мультитенантный CRM:
   * один деплой, разные фирмы видят свои данные. Металлпортал tenant =
   * a1000000-...-001 (legacy), такспарк «Столица» = 66fe829e-...-65.
   */
  tenant?: string
  exp: number
}

/**
 * Дефолтный tenant для backward-compat — Металлпортал. Используется когда
 * сессия не содержит `tenant`, env `TENANT_ID` пустой, или для
 * unauthenticated-request fallback. Меняем только при удалении старых
 * сессий И когда уверены что все клиенты получили tenant в JWT.
 */
export const DEFAULT_TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET environment variable is required')
  return s
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

/**
 * Server-side хелпер для получения tenant_id из текущего request context
 * (Server Components, Route Handlers без явного request). Резолюшн:
 *   1. session.tenant   — если cookie подписана с tenant полем
 *   2. process.env.TENANT_ID — override через env для local dev / preview
 *   3. DEFAULT_TENANT_ID — Металлпортал (backward-compat)
 */
export async function getTenantId(): Promise<string> {
  const session = await getSession()
  return session?.tenant || process.env.TENANT_ID || DEFAULT_TENANT_ID
}

/**
 * Sync helper для Route Handlers/Middleware где явный `request` (NextRequest
 * или Request) — без асинхронного cookies() API. Использовать когда хендлер
 * получает request параметром.
 */
export function getTenantIdFromRequest(request: { headers: { get(name: string): string | null } }): string {
  const session = getSessionFromRequest(request.headers.get('cookie'))
  return session?.tenant || process.env.TENANT_ID || DEFAULT_TENANT_ID
}

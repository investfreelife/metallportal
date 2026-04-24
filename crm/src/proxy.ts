import { NextResponse, type NextRequest } from 'next/server'

// ── Public routes (no auth required) ──────────────────────────────
const PUBLIC_EXACT = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/webhook',
  '/api/orders',
  '/api/track',
])
const PUBLIC_PREFIX = ['/_next/', '/favicon', '/api/auth/', '/track.js']

// ── Edge-compatible HMAC-SHA256 ────────────────────────────────────
const enc = new TextEncoder()

async function verifyToken(token: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET || 'dev-only-insecure-secret-CHANGE-IN-PRODUCTION'
  const dot = token.lastIndexOf('.')
  if (dot === -1) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const key = await globalThis.crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const pad = (s: string) => s.padEnd(s.length + (4 - s.length % 4) % 4, '=')
    const b64ToBytes = (s: string) =>
      Uint8Array.from(atob(pad(s.replace(/-/g, '+').replace(/_/g, '/'))), c => c.charCodeAt(0))
    const valid = await globalThis.crypto.subtle.verify('HMAC', key, b64ToBytes(sig), enc.encode(payload))
    if (!valid) return false
    const data = JSON.parse(atob(pad(payload.replace(/-/g, '+').replace(/_/g, '/'))))
    return Boolean(data?.exp) && data.exp > Date.now()
  } catch {
    return false
  }
}

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  return res
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow static assets
  if (PUBLIC_PREFIX.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Always allow public routes
  if (PUBLIC_EXACT.has(pathname)) {
    return addSecurityHeaders(NextResponse.next())
  }

  const token = request.cookies.get('crm_session')?.value
  const valid = token ? await verifyToken(token) : false

  if (!valid) {
    // API → 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Pages → redirect to /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated user trying to access /login → send to dashboard
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextRequest } from 'next/server'

/**
 * Simple in-memory rate limiter for public API routes.
 *
 * **Limitation**: in-memory only — does NOT work across multi-instance deployments
 * (Vercel Edge, multiple containers, serverless cold starts). Each instance has its
 * own counter, so a determined attacker hitting different instances can multiply
 * the effective limit by N.
 *
 * For production scale, replace with Upstash/Redis-backed limiter.
 * Tracked in follow-up ТЗ (see c001 REPORT).
 *
 * Usage:
 *   if (!checkRateLimit(req, 'ref-track', 60, 60_000)) {
 *     return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
 *   }
 */
const limits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  req: NextRequest,
  key: string,
  max: number,
  windowMs: number
): boolean {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip')?.trim() ??
    'unknown'
  const fullKey = `${key}:${ip}`
  const now = Date.now()
  const entry = limits.get(fullKey)
  if (!entry || entry.resetAt < now) {
    limits.set(fullKey, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

/**
 * Periodic cleanup to avoid unbounded memory growth.
 * Runs every 60s; `unref()` so it never blocks process exit.
 */
const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of limits) {
    if (v.resetAt < now) limits.delete(k)
  }
}, 60_000)
cleanup.unref?.()

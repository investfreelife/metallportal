import { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Distributed rate limiter for public API routes.
 *
 * Strategy:
 *  - Primary: Upstash Redis sliding-window (works across multi-instance
 *    Vercel deployments — Edge runtime, multiple containers, cold starts).
 *  - Fallback: in-memory map (used when Upstash env is not configured;
 *    only correct for single-instance dev / local).
 *
 * Env (already in Vercel per credentials-registry):
 *  - UPSTASH_REDIS_REST_URL
 *  - UPSTASH_REDIS_REST_TOKEN
 *
 * Usage (always async):
 *   if (!(await checkRateLimit(req, 'ref-track', 60, 60_000))) {
 *     return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
 *   }
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

const limiterCache = new Map<string, Ratelimit>()

function getLimiter(max: number, windowMs: number): Ratelimit | null {
  if (!redis) return null
  const cacheKey = `${max}:${windowMs}`
  const cached = limiterCache.get(cacheKey)
  if (cached) return cached
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
    analytics: false,
    prefix: 'crm:rl',
  })
  limiterCache.set(cacheKey, limiter)
  return limiter
}

// In-memory fallback (single-instance only)
const memLimits = new Map<string, { count: number; resetAt: number }>()

function checkInMemory(fullKey: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memLimits.get(fullKey)
  if (!entry || entry.resetAt < now) {
    memLimits.set(fullKey, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

// Periodic cleanup of in-memory entries (no-op when Upstash is active)
const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of memLimits) {
    if (v.resetAt < now) memLimits.delete(k)
  }
}, 60_000)
cleanup.unref?.()

export async function checkRateLimit(
  req: NextRequest,
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip')?.trim() ??
    'unknown'
  const fullKey = `${key}:${ip}`

  const limiter = getLimiter(max, windowMs)
  if (limiter) {
    try {
      const { success } = await limiter.limit(fullKey)
      return success
    } catch {
      // If Upstash is unreachable, fail-open to in-memory rather than 429-everyone.
      return checkInMemory(fullKey, max, windowMs)
    }
  }

  return checkInMemory(fullKey, max, windowMs)
}

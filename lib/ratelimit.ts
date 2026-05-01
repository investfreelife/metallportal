import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Singleton — Redis client is created once per cold-start.
// Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env.
const redis = Redis.fromEnv()

// Per-endpoint sliding-window limiters. Sliding window smooths burst
// patterns better than fixed window for our user-facing forms.

export const orderRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  analytics: true,
  prefix: 'rl:orders',
})

export const generateImageRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: 'rl:genimage',
})

export const documentParseRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'rl:docparse',
})

export const contactRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  analytics: true,
  prefix: 'rl:contact',
})

/**
 * Best-effort client IP from common Vercel/Cloudflare proxy headers.
 * Falls back to "unknown" — ratelimit then groups all unknowns into one
 * bucket which is acceptable for a defence-in-depth layer.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

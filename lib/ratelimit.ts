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

// Semantic catalog search via /api/catalog/rag-search (#c007).
// Each call performs an OpenAI embedding round-trip — costs ~$0.00002, so
// per-IP throttling is mainly to prevent abuse, not protect spend.
export const ragSearchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: true,
  prefix: 'rl:rag-search',
})

/**
 * Best-effort client IP from common Vercel/Cloudflare proxy headers.
 *
 * Header priority:
 *   1. cf-connecting-ip — set by Cloudflare, contains the true end-user IP
 *      and CANNOT be spoofed by clients (CF strips/overwrites it on ingress).
 *      This is the only stable source on harlansteel.ru (CF in front).
 *   2. x-real-ip — Vercel native, used when CF is bypassed (preview URLs).
 *   3. x-forwarded-for[0] — last-resort fallback; spoofable, but the first
 *      hop is generally the trusted edge.
 *
 * Falls back to "unknown" — ratelimit then groups unknowns into one bucket,
 * which is acceptable for a defence-in-depth layer.
 *
 * Closes prod-tail issue from W1-1 REPORT: x-forwarded-for chained through
 * CF was rotating per-request, so spam-test only triggered 429 at attempt 10
 * instead of 6.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  return 'unknown'
}

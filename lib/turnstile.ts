const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * Throws if TURNSTILE_SECRET_KEY env is missing (fail-secure — same
 * pattern as #32 secret fallbacks fix).
 *
 * Pass the client IP (from getClientIp) when available; Cloudflare uses
 * it for additional risk scoring.
 */
export async function verifyTurnstile(
  token: string,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    throw new Error('TURNSTILE_SECRET_KEY not configured')
  }
  if (!token) return false

  const formData = new FormData()
  formData.append('secret', secret)
  formData.append('response', token)
  if (ip && ip !== 'unknown') formData.append('remoteip', ip)

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) return false

  const data = (await res.json()) as {
    success: boolean
    'error-codes'?: string[]
  }
  return data.success === true
}

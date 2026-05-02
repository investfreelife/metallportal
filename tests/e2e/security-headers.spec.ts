import { test, expect } from '@playwright/test'

/**
 * Verifies the security-headers contract on the web project root.
 *
 * Headers come from `next.config.js` async headers() — applied site-wide.
 * Closes B4-HIGH-1 from SECURITY_REVIEW.
 *
 * CSP is in Report-Only mode initially (browser logs violations without
 * blocking) — we'll flip to enforcing once the report-uri yields zero
 * legitimate-traffic violations for ~1 week.
 */
test('security-headers: 6 headers ставятся на главной', async ({ request }) => {
  const res = await request.get('/')
  const headers = res.headers()

  expect(headers['strict-transport-security']).toMatch(/max-age=\d+/)
  expect(headers['strict-transport-security']).toContain('includeSubDomains')

  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')

  expect(headers['permissions-policy']).toContain('camera=()')
  expect(headers['permissions-policy']).toContain('microphone=()')

  // CSP is Report-Only — different header name than enforced CSP.
  expect(headers['content-security-policy-report-only']).toContain(
    "default-src 'self'",
  )
  expect(headers['content-security-policy-report-only']).toContain(
    'frame-ancestors',
  )
})

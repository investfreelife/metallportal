import type { NextConfig } from 'next'

// Security headers (без CSP — у CRM свой набор источников, добавим
// в отдельной задаче после сбора Report-Only-данных с web).
// Дублирует тот же набор что web ставит — defence in depth поверх
// proxy.ts middleware (proxy не всегда срабатывает на статике).
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

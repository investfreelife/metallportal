import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { documentParseRatelimit, getClientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
const AI_KEY = process.env.AI_API_KEY || ''

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'image/jpeg',
  'image/png',
])
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  // 1. Any authenticated user — backend cost amplification protection.
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2. Rate-limit per user (5 / 15 min). One user across IPs counts together.
  const rl = await documentParseRatelimit.limit(`user:${user.id}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Слишком много загрузок. Попробуйте позже.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.reset),
        },
      },
    )
  }

  // 3. Multipart parse + size + content-type guard
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large (max 10MB)' },
      { status: 413 },
    )
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 },
    )
  }

  // 4. Drop client IP (best-effort) for backend logging.
  // Re-build FormData so harlan-ai sees only validated fields.
  const ip = getClientIp(req)

  try {
    const res = await fetch(`${AI_BASE}/api/documents/parse`, {
      method: 'POST',
      headers: {
        'X-API-Key': AI_KEY,
        'X-Forwarded-For': ip,
        'X-User-Id': user.id,
      },
      body: formData,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }
}

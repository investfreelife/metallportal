import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  // PUBLIC BY DESIGN: cron job, secret-protected via CRON_SECRET.
  const auth = requireCronSecret(req)
  if (!auth.ok) return auth.error

  const cronSecret = process.env.CRON_SECRET ?? ''

  await fetch(
    `${process.env.NEXT_PUBLIC_AI_URL}/api/cron/morning`,
    {
      method: 'POST',
      headers: { 'X-Cron-Secret': cronSecret },
    }
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}

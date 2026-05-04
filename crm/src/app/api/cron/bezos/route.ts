import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  // PUBLIC BY DESIGN: cron job, secret-protected via CRON_SECRET.
  const auth = requireCronSecret(req)
  if (!auth.ok) return auth.error

  const today = new Date()
  if (today.getDay() !== 1) {
    return NextResponse.json({ skipped: true, reason: 'Not Monday', day: today.getDay() })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://metallportal-crm2.vercel.app'
  const internalSecret = process.env.INTERNAL_API_SECRET ?? ''
  const res = await fetch(`${baseUrl}/api/bezos/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalSecret,
    },
  })

  const data = await res.json()
  return NextResponse.json({ ok: true, reportLength: data.report?.length })
}

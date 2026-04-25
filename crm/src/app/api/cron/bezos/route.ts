import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const today = new Date()
  if (today.getDay() !== 1) {
    return NextResponse.json({ skipped: true, reason: 'Not Monday', day: today.getDay() })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://metallportal-crm2.vercel.app'
  const res = await fetch(`${baseUrl}/api/bezos/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await res.json()
  return NextResponse.json({ ok: true, reportLength: data.report?.length })
}

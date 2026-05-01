import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return new NextResponse('CRON_SECRET not configured', { status: 500 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  await fetch(
    `${process.env.NEXT_PUBLIC_AI_URL}/api/cron/morning`,
    {
      method: 'POST',
      headers: { 'X-Cron-Secret': cronSecret },
    }
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  await fetch(
    `${process.env.NEXT_PUBLIC_AI_URL}/api/cron/morning`,
    {
      method: 'POST',
      headers: { 'X-Cron-Secret': process.env.CRON_SECRET || '' },
    }
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (provided !== cronSecret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const aiUrl = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'

  try {
    const res = await fetch(`${aiUrl}/api/cron/morning`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': cronSecret },
    })

    if (!res.ok) {
      console.error('[cron] AI service responded with', res.status)
      return NextResponse.json({ ok: false, status: res.status }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cron] Failed to trigger agents:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

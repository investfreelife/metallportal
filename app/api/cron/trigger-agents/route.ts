import { NextResponse } from 'next/server'

export async function GET() {
  const aiUrl = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
  const cronSecret = process.env.CRON_SECRET || ''

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

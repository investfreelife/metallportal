import { NextRequest, NextResponse } from 'next/server'

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'https://harlan-ai-production-production.up.railway.app'
const AI_KEY = process.env.AI_API_KEY || 'harlan_steel_ai_2024_secret_key_xK9mP3nQ'

export async function POST(req: NextRequest) {
  const { agent } = await req.json()
  const valid = ['bezos', 'smm', 'seller', 'analyst', 'scout', 'secretary']
  if (!valid.includes(agent)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 400 })
  }

  try {
    const endpoint = agent === 'bezos'
      ? '/api/agents/bezos/morning'
      : `/api/agents/${agent}/run`

    const res = await fetch(`${AI_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'X-API-Key': AI_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({
      ok: true,
      summary: data.summary || data.message || `Агент ${agent} запущен`,
      actionsCount: data.actionsCount || 0,
    })
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return NextResponse.json({
        ok: true,
        summary: `Агент ${agent} запущен в фоне. Проверьте Telegram через 1-2 минуты.`,
        actionsCount: 0,
      })
    }
    return NextResponse.json({ ok: false, summary: 'Ошибка: ' + e.message })
  }
}

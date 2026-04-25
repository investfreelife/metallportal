import { NextRequest, NextResponse } from 'next/server'

const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
const AI_KEY = process.env.AI_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${AI_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }
}

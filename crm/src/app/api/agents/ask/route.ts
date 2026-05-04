import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/apiAuth'

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'https://harlan-ai-production-production.up.railway.app'
const AI_KEY = process.env.AI_API_KEY || 'harlan_steel_ai_2024_secret_key_xK9mP3nQ'

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'manager', 'admin'])
  if (!auth.ok) return auth.error

  const { question } = await req.json()

  try {
    const res = await fetch(`${AI_URL}/api/agents/bezos/ask`, {
      method: 'POST',
      headers: { 'X-API-Key': AI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ answer: data.answer || data.result || data.message || '' })
  } catch (e: any) {
    return NextResponse.json({ answer: 'Безос думает... попробуй снова через минуту.' })
  }
}

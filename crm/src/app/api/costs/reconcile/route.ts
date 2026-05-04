import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  // Financial data — owners only.
  const auth = requireRole(req, ['owner', 'admin'])
  if (!auth.ok) return auth.error

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_AI_URL}/api/costs/openrouter`,
    {
      headers: { 'X-API-Key': process.env.AI_API_KEY || process.env.NEXT_PUBLIC_AI_KEY || '' },
      signal: AbortSignal.timeout(15000),
    }
  )
  return NextResponse.json(await res.json())
}

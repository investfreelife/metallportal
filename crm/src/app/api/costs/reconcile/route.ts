import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_AI_URL}/api/costs/openrouter`,
    {
      headers: { 'X-API-Key': process.env.AI_API_KEY || process.env.NEXT_PUBLIC_AI_KEY || '' },
      signal: AbortSignal.timeout(15000),
    }
  )
  return NextResponse.json(await res.json())
}

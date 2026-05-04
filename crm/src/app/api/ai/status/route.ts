import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  return NextResponse.json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai_whisper: Boolean(process.env.OPENAI_API_KEY),
  })
}

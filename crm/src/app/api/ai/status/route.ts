import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai_whisper: Boolean(process.env.OPENAI_API_KEY),
  })
}

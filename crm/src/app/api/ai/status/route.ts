import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    anthropic:  Boolean(process.env.ANTHROPIC_API_KEY),
    openai:     Boolean(process.env.OPENAI_API_KEY),
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getAllSettings, setSetting } from '@/lib/settings'

const ALLOWED_KEYS = [
  'OPENROUTER_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'CRM_MANAGER_TG_ID',
  'RESEND_API_KEY',
  'CRM_FROM_EMAIL',
  'WEBHOOK_SECRET',
]

export async function GET() {
  const settings = await getAllSettings()
  // Mask secret keys — show only last 4 chars
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(settings)) {
    masked[k] = v.length > 8 ? '••••••••' + v.slice(-4) : '••••'
  }
  // Also show env-based keys as set (don't expose values)
  for (const key of ALLOWED_KEYS) {
    if (process.env[key] && !masked[key]) {
      masked[key] = '(из env)'
    }
  }
  return NextResponse.json({ settings: masked })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const saved: string[] = []

  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined && body[key].trim() !== '' && !body[key].startsWith('••')) {
      await setSetting(key, body[key].trim())
      saved.push(key)
    }
  }

  return NextResponse.json({ ok: true, saved })
}

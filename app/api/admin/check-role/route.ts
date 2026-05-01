import { NextResponse } from 'next/server'
import { getCurrentRole } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const role = await getCurrentRole()
  return NextResponse.json({ role })
}

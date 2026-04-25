import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { id, status, content } = await req.json()
  const supabase = await createClient()
  await supabase.from('ai_queue')
    .update({ status, content: content || undefined, updated_at: new Date().toISOString() })
    .eq('id', id)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSession(req)
  if (!auth.ok) return auth.error

  const { id } = await params
  const body = await req.json()
  const supabase = getSupabase()

  const update: Record<string, unknown> = {}
  if (body.status !== undefined) {
    update.status = body.status
    if (body.status === 'done') update.done_at = new Date().toISOString()
    if (body.status === 'pending') update.done_at = null
  }
  if (body.title !== undefined) update.title = body.title
  if (body.priority !== undefined) update.priority = body.priority
  if (body.due_at !== undefined) update.due_at = body.due_at

  const { error } = await supabase.from('tasks').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

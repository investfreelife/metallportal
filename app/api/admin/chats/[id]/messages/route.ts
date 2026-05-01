import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/chats/[id]/messages
 * Returns messages of a chat ordered chronologically.
 * Optional ?since=<iso> to fetch only new messages (for polling).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const { id } = await params
  const since = new URL(req.url).searchParams.get('since')

  const admin = createAdminClient()
  let q = admin
    .from('messages')
    .select('*')
    .eq('chat_id', id)
    .order('created_at', { ascending: true })
  if (since) q = q.gt('created_at', since)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

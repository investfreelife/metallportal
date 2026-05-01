import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/admin/chats
 * Returns ALL chats — admin sees every customer thread.
 *
 * Note: previous implementation used Supabase Realtime to push updates
 * to the browser via anon-key. With RLS-rewrite making chats
 * owner-private, realtime no longer works for admin-side. Client
 * should poll this endpoint every few seconds instead (or we add a
 * separate SSE stream later).
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('chats')
    .select('*')
    .order('last_message_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

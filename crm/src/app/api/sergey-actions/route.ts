import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/sergey-actions
 *
 * Returns all actions с current status + ownership + last check info.
 * Read-only — для SergeyActions UI panel.
 *
 * Sergey directive 2026-05-17: «кто отвечает / кто проверяет / где прогресс».
 * Этот endpoint = единый источник правды.
 */

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  const supabase = admin()
  const { data, error } = await supabase
    .from('sergey_actions')
    .select('*')
    .order('priority', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { actions: data ?? [], count: data?.length ?? 0 },
    { headers: { 'cache-control': 'no-store' } }
  )
}

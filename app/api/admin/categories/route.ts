import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/admin/categories
 * Lists ALL categories (incl. inactive — admin needs to see disabled too).
 * Designer can read for photo workflow.
 */
export async function GET() {
  const auth = await requireRole(['admin', 'designer'])
  if (!auth.ok) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/admin/categories
 * Body: any insertable category fields.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('categories').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

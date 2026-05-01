import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST /api/admin/products/bulk-delete
 * Body: { ids: string[] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const body = await req.json().catch(() => null)
  const ids = Array.isArray(body?.ids) ? body.ids : null
  if (!ids?.length) {
    return NextResponse.json({ error: 'ids[] required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('products').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: ids.length })
}

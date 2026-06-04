import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * POST /api/admin/suppliers/[id]/apply-markup
 *
 * Bulk-apply a new markup_percent to all price_items of given supplier.
 * Body: { markup_percent: number (0-100) }
 *
 * Recalc happens automatically через DB trigger `trg_suppliers_markup_recalc`
 * when suppliers.markup_percent UPDATE fires. This endpoint:
 *   1. Updates supplier.markup_percent (which triggers the recalc).
 *   2. Counts affected price_items.
 *   3. Writes a `apply_markup_bulk` audit_log entry.
 *
 * Idempotent: re-running с same markup is no-op (no change detected by
 * trigger's IS DISTINCT FROM check).
 */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const { id } = await context.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const markupPercent = body.markup_percent
  if (
    typeof markupPercent !== 'number' ||
    markupPercent < 0 ||
    markupPercent > 100
  ) {
    return NextResponse.json(
      { error: 'markup_percent must be number 0-100' },
      { status: 400 },
    )
  }

  // Cast as unknown — `lib/database.types.ts` predates c012's columns
  // (code / markup_percent / is_active / contact_info / supplier_audit_log).
  // Regenerate types after merge to drop the cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // 1. Read current markup для audit
  const { data: existing } = await sb
    .from('suppliers')
    .select('markup_percent, code, company_name')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'supplier not found' }, { status: 404 })
  }

  const oldMarkup = Number((existing as { markup_percent: string }).markup_percent)

  // 2. Update markup_percent (DB trigger handles bulk recalc)
  const { error: upErr } = await sb
    .from('suppliers')
    .update({ markup_percent: markupPercent })
    .eq('id', id)

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // 3. Count affected price_items
  const { count } = await sb
    .from('price_items')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', id)

  // 4. Audit log
  await sb.from('supplier_audit_log').insert({
    supplier_id: id,
    action: 'apply_markup_bulk',
    old_value: { markup_percent: oldMarkup },
    new_value: { markup_percent: markupPercent },
    affected_rows: count ?? 0,
    performed_by: auth.userId,
    notes: `Bulk markup apply: ${oldMarkup}% → ${markupPercent}% across ${count ?? 0} price_items`,
  })

  return NextResponse.json({
    ok: true,
    supplier_id: id,
    code: (existing as { code: string }).code,
    old_markup_percent: oldMarkup,
    new_markup_percent: markupPercent,
    affected_rows: count ?? 0,
  })
}

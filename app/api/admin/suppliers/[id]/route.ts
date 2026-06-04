import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/suppliers/[id]
 * Update supplier fields. If markup_percent changes — DB trigger
 * `trg_suppliers_markup_recalc` automatically recalculates final_price
 * for all related price_items. Audit log records markup_changed event.
 *
 * DELETE /api/admin/suppliers/[id]
 * Soft-delete via is_active=false (lesson 075 — no destructive removal).
 * Audit log records soft_deleted event.
 */

const PATCHABLE_FIELDS = [
  'company_name',
  'markup_percent',
  'is_active',
  'contact_info',
  'contact_person',
  'contact_phone',
  'contact_email',
  'inn',
  'kpp',
  'ogrn',
  'legal_address',
  'description',
  'logo_url',
  'region',
  'city',
  'rating',
  'is_verified',
] as const

export async function PATCH(
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

  const update: Record<string, unknown> = {}
  for (const f of PATCHABLE_FIELDS) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  // Validate markup_percent range
  if (
    'markup_percent' in update &&
    (typeof update.markup_percent !== 'number' ||
      (update.markup_percent as number) < 0 ||
      (update.markup_percent as number) > 100)
  ) {
    return NextResponse.json(
      { error: 'markup_percent must be number 0-100' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Read current values for audit log diff
  const { data: existing } = await sb
    .from('suppliers')
    .select('markup_percent, is_active')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'supplier not found' }, { status: 404 })
  }

  const { data, error } = await sb
    .from('suppliers')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log: markup change is the most-tracked event;
  // also log generic «updated» если only other fields changed.
  const oldMarkup = (existing as { markup_percent: string }).markup_percent
  const newMarkup = (data as { markup_percent: string }).markup_percent
  const markupChanged = String(oldMarkup) !== String(newMarkup)

  if (markupChanged) {
    const { count } = await sb
      .from('price_items')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id)

    await sb.from('supplier_audit_log').insert({
      supplier_id: id,
      action: 'markup_changed',
      old_value: { markup_percent: oldMarkup },
      new_value: { markup_percent: newMarkup },
      affected_rows: count ?? 0,
      performed_by: auth.userId,
    })
  } else {
    await sb.from('supplier_audit_log').insert({
      supplier_id: id,
      action: 'updated',
      new_value: update,
      performed_by: auth.userId,
    })
  }

  return NextResponse.json({ supplier: data })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  const { id } = await context.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data, error } = await sb
    .from('suppliers')
    .update({ is_active: false })
    .eq('id', id)
    .select('id, code, is_active')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'supplier not found' }, { status: 404 })
  }

  await sb.from('supplier_audit_log').insert({
    supplier_id: id,
    action: 'soft_deleted',
    performed_by: auth.userId,
    notes: `Soft-deleted via DELETE /api/admin/suppliers/${id}`,
  })

  return NextResponse.json({ ok: true })
}

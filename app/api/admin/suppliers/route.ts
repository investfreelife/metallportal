import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/admin/suppliers
 * Lists all suppliers (включая is_active=false для admin) с computed counts.
 *
 * POST /api/admin/suppliers
 * Creates a new supplier. Body:
 *   { code: string (slug),
 *     company_name: string,
 *     markup_percent?: number (0-100, default 0),
 *     contact_info?: object,
 *     contact_phone?, contact_email?, contact_person?, region?, city?,
 *     inn?, kpp?, ogrn?, legal_address?, description?, logo_url?,
 *     is_verified?: boolean, rating?: number }
 *
 * Auth: admin role required (lib/auth.requireAdmin).
 *
 * Audit: insert event «created» в supplier_audit_log.
 */

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data, error } = await sb
    .from('suppliers')
    .select(
      'id, code, company_name, markup_percent, is_active, contact_info, ' +
        'contact_person, contact_phone, contact_email, ' +
        'inn, kpp, ogrn, legal_address, description, logo_url, ' +
        'region, city, rating, is_verified, created_at, updated_at',
    )
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ suppliers: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const companyName =
    typeof body.company_name === 'string' ? body.company_name.trim() : ''
  if (!code || !companyName) {
    return NextResponse.json(
      { error: 'code and company_name required' },
      { status: 400 },
    )
  }
  if (!/^[a-z0-9_-]+$/i.test(code)) {
    return NextResponse.json(
      { error: 'code must be alphanumeric / dash / underscore' },
      { status: 400 },
    )
  }

  const markupPercent =
    typeof body.markup_percent === 'number' ? body.markup_percent : 0
  if (markupPercent < 0 || markupPercent > 100) {
    return NextResponse.json(
      { error: 'markup_percent must be between 0 and 100' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const insert: Record<string, unknown> = {
    code,
    company_name: companyName,
    markup_percent: markupPercent,
    is_active: typeof body.is_active === 'boolean' ? body.is_active : true,
  }
  // Optional structured fields — pass-through if provided.
  for (const k of [
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
  ]) {
    if (body[k] !== undefined) insert[k] = body[k]
  }

  const { data, error } = await sb
    .from('suppliers')
    .insert(insert)
    .select()
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') {
      return NextResponse.json({ error: 'supplier code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log entry
  await sb.from('supplier_audit_log').insert({
    supplier_id: (data as { id: string }).id,
    action: 'created',
    new_value: {
      code,
      company_name: companyName,
      markup_percent: markupPercent,
    },
    performed_by: auth.userId,
  })

  return NextResponse.json({ supplier: data }, { status: 201 })
}

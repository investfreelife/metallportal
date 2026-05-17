import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/managers/available
 *
 * Returns list of available managers (manager_extensions where status =
 * 'available') for the transfer-call modal. Used by `TransferCallButton`
 * to populate the dropdown.
 *
 * Auth: requireRole(['owner','admin','manager','staff']).
 *
 * Response:
 *   {
 *     managers: [
 *       { id, user_id, phone_e164, display_name, status, is_primary_fallback }
 *     ],
 *     groups: [
 *       { id, name, algorithm, member_count }
 *     ]
 *   }
 */

const TENANT_ID = process.env.TENANT_ID || 'a1000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin', 'manager', 'staff'])
  if (!auth.ok) return auth.error

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: managers }, { data: groups }] = await Promise.all([
    supabase
      .from('manager_extensions')
      .select('id, user_id, phone_e164, display_name, status, is_primary_fallback')
      .eq('tenant_id', TENANT_ID)
      .order('is_primary_fallback', { ascending: false })
      .order('display_name'),
    supabase
      .from('manager_groups')
      .select('id, name, algorithm, member_user_ids')
      .eq('tenant_id', TENANT_ID)
      .order('name'),
  ])

  return NextResponse.json({
    managers: managers ?? [],
    groups: (groups ?? []).map(
      (g: { id: string; name: string; algorithm: string; member_user_ids: string[] }) => ({
        id: g.id,
        name: g.name,
        algorithm: g.algorithm,
        member_count: g.member_user_ids?.length ?? 0,
      }),
    ),
  })
}

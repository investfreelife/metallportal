import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * PATCH /api/recruit/referral/[id]
 *
 * Task 067: смена статуса реферала (pending→approved→paid / rejected),
 * правка shifts/reward. Merge в config, tenant-guard.
 *
 * Body whitelist:
 *   status, shifts (number), reward (number), note (string)
 */
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'paid', 'rejected']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (typeof body.status === 'string' && ALLOWED_STATUSES.has(body.status)) patch.status = body.status;
    if (typeof body.shifts === 'number') patch.shifts = body.shifts;
    if (typeof body.reward === 'number') patch.reward = body.reward;
    if (typeof body.note === 'string') patch.note = body.note.slice(0, 2000);
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }
    if (patch.status === 'paid') patch.paid_at = new Date().toISOString();

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('channels')
      .select('id, config')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .single();
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (cfg.kind !== 'referral') {
      return NextResponse.json({ error: 'config.kind != referral' }, { status: 400 });
    }
    const next = { ...cfg, ...patch };
    const { data, error: updErr } = await supabase
      .from('channels')
      .update({ config: next })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, config')
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

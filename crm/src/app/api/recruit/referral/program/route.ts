import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET / PATCH /api/recruit/referral/program
 *
 * Task 067: структура реферальной программы. Лежит в channels
 * (type='tracking', config.kind='referral_program'). Поля config:
 *   { enabled, inviter_reward, inviter_threshold_shifts, newbie_reward,
 *     statuses: [{name,active_needed}], tiers?, leaderboard?, note }
 *
 * PATCH — whitelist + merge. Не перезаписывает config.kind.
 */
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'enabled', 'inviter_reward', 'inviter_threshold_shifts', 'newbie_reward',
  'statuses', 'tiers', 'leaderboard', 'note',
]);

async function loadProgram(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channels')
    .select('id, config')
    .eq('tenant_id', tenantId)
    .eq('type', 'tracking')
    .limit(2000);
  if (error) return { error: error.message, row: null as null, supabase: null };
  const row = (data ?? []).find((r) => {
    const c = r.config as { kind?: string } | null;
    return c?.kind === 'referral_program';
  }) ?? null;
  return { error: null as string | null, row, supabase };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { error, row } = await loadProgram(tenantId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ program: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED.has(k)) patch[k] = v;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }

    const { error, row, supabase } = await loadProgram(tenantId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!supabase || !row) return NextResponse.json({ error: 'Программа не найдена (нужен сид)' }, { status: 404 });

    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const next = { ...cfg, ...patch, kind: 'referral_program' };

    const { data, error: updErr } = await supabase
      .from('channels')
      .update({ config: next })
      .eq('id', row.id)
      .eq('tenant_id', tenantId)
      .select('id, config')
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ program: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

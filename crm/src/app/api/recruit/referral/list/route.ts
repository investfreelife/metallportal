import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/referral/list
 *
 * Task 067: список рефералов (channels kind='referral'), сводка к выплате,
 * лидерборд (топ по approved).
 *
 * Query:
 *   ?status=pending|approved|paid|rejected
 *
 * Returns: { items, summary: {total,pending,approved,paid,rejected,due_amount},
 *           leaderboard: [{referrer_tg, referrer_name, approved_count, earned}] }
 */
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  config: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const status = req.nextUrl.searchParams.get('status');

    const supabase = await createClient();
    const rows: Row[] = [];
    const CHUNK = 1000;
    for (let offset = 0; offset < 10_000; offset += CHUNK) {
      const { data, error } = await supabase
        .from('channels')
        .select('id, config, created_at')
        .eq('tenant_id', tenantId)
        .eq('type', 'tracking')
        .order('created_at', { ascending: false })
        .range(offset, offset + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as Row[];
      rows.push(...batch.filter((r) => (r.config as { kind?: string } | null)?.kind === 'referral'));
      if (batch.length < CHUNK) break;
    }

    const summary = { total: rows.length, pending: 0, approved: 0, paid: 0, rejected: 0, due_amount: 0 };
    const byReferrer = new Map<string, { tg: string; name: string; approved: number; earned: number }>();

    for (const r of rows) {
      const c = (r.config ?? {}) as Record<string, unknown>;
      const st = String(c.status ?? 'pending');
      if (st in summary) (summary as Record<string, number>)[st]++;
      const reward = Number(c.reward ?? 0);
      if (st === 'approved') summary.due_amount += reward;
      const tg = String(c.referrer_tg ?? '—');
      const name = String(c.referrer_name ?? tg);
      const cur = byReferrer.get(tg) ?? { tg, name, approved: 0, earned: 0 };
      if (st === 'approved' || st === 'paid') cur.approved++;
      if (st === 'paid') cur.earned += reward;
      cur.name = name; // обновим если в новой записи есть
      byReferrer.set(tg, cur);
    }

    let items = rows;
    if (status) items = items.filter((r) => String((r.config as { status?: string } | null)?.status ?? 'pending') === status);

    const leaderboard = Array.from(byReferrer.values())
      .sort((a, b) => b.approved - a.approved || b.earned - a.earned)
      .slice(0, 20);

    return NextResponse.json({ items, summary, leaderboard });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

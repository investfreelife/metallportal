import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/marketing/strategy
 *
 * Шаги стратегии tenant'а ПО ПОРЯДКУ (step_order ASC).
 * Каждый шаг — карточка с title/body/status/note (комментарий
 * «поправить»).
 *
 * Sergey directive 2026-06-04: «вкладка Стратегия с пошаговым
 * согласованием».
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('marketing_strategy')
      .select('id, step_order, title, kind, body, status, segment, note, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('step_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ steps: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

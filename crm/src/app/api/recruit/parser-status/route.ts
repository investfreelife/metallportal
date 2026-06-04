import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/parser-status
 *
 * Читает строку channels с config.kind='parser_status' (демон-парсер
 * её обновляет каждые N секунд). Также подтягивает parser_control —
 * флаг паузы от Сергея (бот его слушает).
 *
 * Returns: {
 *   status:    {running, paused, last_query, found_total, found_small,
 *              found_large, cycle, queries_done, queries_total,
 *              flood_until, engine, updated_at} | null,
 *   control:   {paused, paused_by, paused_at} | null
 * }
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('channels')
      .select('id, name, status, config, updated_at')
      .eq('tenant_id', tenantId)
      .or('config->>kind.eq.parser_status,config->>kind.eq.parser_control')
      .limit(5);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let parserStatus: Record<string, unknown> | null = null;
    let parserControl: Record<string, unknown> | null = null;

    for (const r of data ?? []) {
      const cfg = (r.config ?? {}) as Record<string, unknown>;
      const kind = cfg.kind;
      const enriched = { ...cfg, updated_at: r.updated_at };
      if (kind === 'parser_status') parserStatus = enriched;
      else if (kind === 'parser_control') parserControl = enriched;
    }

    return NextResponse.json({ status: parserStatus, control: parserControl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

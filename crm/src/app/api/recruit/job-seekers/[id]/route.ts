import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * PATCH /api/recruit/job-seekers/[id]
 *
 * Task 065: ручные пометки соискателя (contacted / human_status / note /
 * labels). Read-modify-write merge в config (НЕ перезаписываем весь config
 * — у парсера там оригинал, msg_ts и т.д.).
 *
 * Body whitelist:
 *   contacted: boolean
 *   human_status: 'new'|'contacted'|'replied'|'in_bot'|'joined'|'rejected'
 *   note: string
 *   labels: string[]  // массив имён меток (см. labels_dict, Task 066)
 */
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['new', 'contacted', 'replied', 'in_bot', 'joined', 'rejected']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (typeof body.contacted === 'boolean') patch.contacted = body.contacted;
    if (typeof body.human_status === 'string' && ALLOWED_STATUSES.has(body.human_status)) {
      patch.human_status = body.human_status;
    }
    if (typeof body.note === 'string') patch.note = body.note.slice(0, 2000);
    if (Array.isArray(body.labels)) {
      patch.labels = body.labels.map((s: unknown) => String(s).slice(0, 80)).slice(0, 50);
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: existing, error: getErr } = await supabase
      .from('channels')
      .select('id, config')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .single();
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

    const cfg = (existing.config ?? {}) as Record<string, unknown>;
    if (cfg.kind !== 'job_seeker') {
      return NextResponse.json({ error: 'config.kind != job_seeker' }, { status: 400 });
    }
    const next = { ...cfg, ...patch };

    const { data: upd, error: updErr } = await supabase
      .from('channels')
      .update({ config: next })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, config')
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ row: upd });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

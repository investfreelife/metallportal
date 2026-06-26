import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * PATCH /api/recruit/communication/[id]
 *
 * Body: { source: 'seeker'|'lead', labels?: string[], stage?: string, note?: string }
 *
 * Для seeker → пишем в channels.config (merge: labels, human_status, note).
 * Для lead   → пишем в contacts (labels, stage). stage идёт через тот же
 *   whitelist что в /funnel-stages PATCH.
 */
export const dynamic = 'force-dynamic';

const CONTACTS_WHITELIST = new Set(['stage', 'labels', 'next_touch_at', 'segment', 'city']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const source = body.source;
    if (source !== 'seeker' && source !== 'lead') {
      return NextResponse.json({ error: 'source: seeker|lead' }, { status: 400 });
    }
    const labels = Array.isArray(body.labels)
      ? body.labels.map((s: unknown) => String(s).slice(0, 80)).slice(0, 50)
      : undefined;

    const supabase = await createClient();

    if (source === 'seeker') {
      const { data: existing } = await supabase
        .from('channels')
        .select('id, config')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('type', 'tracking')
        .single();
      if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
      const cfg = (existing.config ?? {}) as Record<string, unknown>;
      if (cfg.kind !== 'job_seeker') {
        return NextResponse.json({ error: 'config.kind != job_seeker' }, { status: 400 });
      }
      const merged: Record<string, unknown> = { ...cfg };
      if (labels) merged.labels = labels;
      if (typeof body.stage === 'string') merged.human_status = body.stage;
      if (typeof body.note === 'string') merged.note = body.note.slice(0, 2000);
      const { data, error } = await supabase
        .from('channels')
        .update({ config: merged })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ row: data });
    }

    // source === 'lead'
    const patch: Record<string, unknown> = {};
    if (labels) patch.labels = labels;
    if (typeof body.stage === 'string') patch.stage = body.stage;
    for (const k of Object.keys(patch)) {
      if (!CONTACTS_WHITELIST.has(k)) delete patch[k];
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

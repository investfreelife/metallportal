import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['status', 'note', 'title', 'body']);

/**
 * PATCH /api/recruit/marketing/strategy/[id]
 * body: { status?, note?, title?, body? }
 *
 * Используется кнопками «✅ Согласовать» (status='approved') и
 * «✏️ Поправить» (status='revise' + note=коммент). Также можно
 * руками править title/body.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!ALLOWED.has(k)) continue;
      if (v === null) patch[k] = null;
      else if (typeof v === 'string') {
        const trimmed = v.trim();
        patch[k] = trimmed || null;
      }
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('marketing_strategy')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, step_order, title, kind, body, status, segment, note, created_at, updated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

    return NextResponse.json({ step: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

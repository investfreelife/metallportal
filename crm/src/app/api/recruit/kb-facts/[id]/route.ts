import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['question', 'answer']);

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
      if (ALLOWED.has(k) && typeof v === 'string' && v.trim()) {
        patch[k] = v.trim();
      }
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('kb_facts')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, question, answer, added_by, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    return NextResponse.json({ fact: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const supabase = await createClient();
    const { error } = await supabase
      .from('kb_facts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

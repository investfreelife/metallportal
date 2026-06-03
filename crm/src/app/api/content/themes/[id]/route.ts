import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

const ALLOWED = new Set(['rubric', 'title', 'idea', 'status', 'priority', 'post_id']);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) patch[k] = v;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_themes')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  return NextResponse.json({ theme: data });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { error } = await supabase
    .from('content_themes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

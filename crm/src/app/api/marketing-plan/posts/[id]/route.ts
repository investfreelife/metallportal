import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * PATCH /api/marketing-plan/posts/[id]
 * body: частичный апдейт ad_variants — только белый список полей,
 * tenant-scoped.
 *
 * Допустимые поля:
 *   label, text, photo_url, campaign_id, channel, status,
 *   scheduled_at, published_at, note, utm
 *
 * Task 050: копия /api/content/posts/[id] с маппингом полей.
 */
const ALLOWED = new Set([
  'label', 'text', 'photo_url', 'campaign_id', 'channel',
  'status', 'scheduled_at', 'published_at', 'note', 'utm',
]);

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
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ad_variants')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  return NextResponse.json({ post: data });
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
    .from('ad_variants')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

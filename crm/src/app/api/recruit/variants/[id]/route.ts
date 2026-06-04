import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { buildUtm } from '@/lib/marketing/types';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['label', 'text', 'photo_url', 'status']);

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
      if (typeof v === 'string') patch[k] = v;
      else if (v === null) patch[k] = null;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }

    const supabase = await createClient();

    // Если поменялся label — пересчитываем utm (нужно имя кампании).
    if (typeof patch.label === 'string') {
      const newLabel = String(patch.label).trim().toUpperCase().slice(0, 5);
      patch.label = newLabel;
      const { data: existing } = await supabase
        .from('ad_variants')
        .select('campaign_id, campaigns(name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle<{ campaign_id: string; campaigns: { name: string } | null }>();
      if (existing?.campaigns?.name) {
        patch.utm = buildUtm(existing.campaigns.name, newLabel);
      }
    }

    const { data, error } = await supabase
      .from('ad_variants')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, campaign_id, label, text, photo_url, utm, status, sent_count, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    return NextResponse.json({ variant: data });
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
    await supabase.from('mailing_jobs').delete().eq('variant_id', id).eq('tenant_id', tenantId);
    const { error } = await supabase
      .from('ad_variants')
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['name', 'objective', 'audience', 'status']);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const supabase = await createClient();
    const [{ data: campaign, error: cErr }, { data: variants }, { data: jobs }] = await Promise.all([
      supabase
        .from('campaigns')
        .select('id, name, objective, audience, status, created_at')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('ad_variants')
        .select('id, campaign_id, label, text, photo_url, utm, status, sent_count, created_at')
        .eq('campaign_id', id)
        .eq('tenant_id', tenantId)
        .order('label', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('mailing_jobs')
        .select('id, variant_id, target_kind, target, status, scheduled_at, posted_at, result, created_at')
        .eq('campaign_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(2000),
    ]);

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (!campaign) return NextResponse.json({ error: 'Не найдена' }, { status: 404 });

    return NextResponse.json({
      campaign,
      variants: variants ?? [],
      jobs: jobs ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
      if (typeof v === 'string') {
        const t = v.trim();
        patch[k] = t || null;
      } else if (v === null) patch[k] = null;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, name, objective, audience, status, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    return NextResponse.json({ campaign: data });
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
    // удаляем jobs и variants первыми (если в БД нет каскада).
    await supabase.from('mailing_jobs').delete().eq('campaign_id', id).eq('tenant_id', tenantId);
    await supabase.from('ad_variants').delete().eq('campaign_id', id).eq('tenant_id', tenantId);
    const { error } = await supabase
      .from('campaigns')
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { buildUtm } from '@/lib/marketing/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recruit/campaigns/[id]/variants
 *
 * Создать новый A/B-вариант. label автоматически назначается следующей
 * буквой (A, B, C…) если не указан. utm auto = `ab-<slug>-<label>`.
 *
 * body: { label?, text?, photo_url? }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id: campaignId } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const supabase = await createClient();

    // Достать кампанию (для name → utm) + существующие label'ы (auto-next)
    const [{ data: campaign }, { data: existing }] = await Promise.all([
      supabase
        .from('campaigns')
        .select('id, name')
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('ad_variants')
        .select('label')
        .eq('campaign_id', campaignId)
        .eq('tenant_id', tenantId),
    ]);
    if (!campaign) return NextResponse.json({ error: 'Кампания не найдена' }, { status: 404 });

    // авто-label: A → B → C …
    let label = String(body.label ?? '').trim().toUpperCase().slice(0, 5);
    if (!label) {
      const used = new Set((existing ?? []).map((v) => String(v.label ?? '').toUpperCase()));
      for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (!used.has(letter)) { label = letter; break; }
      }
      if (!label) label = `V${(existing?.length ?? 0) + 1}`;
    }

    const text = body.text != null ? String(body.text) : null;
    const photo_url = body.photo_url != null ? String(body.photo_url).trim() : null;
    const utm = buildUtm(campaign.name, label);

    const { data, error } = await supabase
      .from('ad_variants')
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        label,
        text,
        photo_url,
        utm,
        status: 'draft',
        sent_count: 0,
      })
      .select('id, campaign_id, label, text, photo_url, utm, status, sent_count, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ variant: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

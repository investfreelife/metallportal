import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recruit/campaigns/[id]/jobs
 *
 * Bulk-create mailing_jobs для всех (variants × targets). Это просто
 * формирует ОЧЕРЕДЬ (status='queued'). Сами посты шлёт фоновый демон —
 * медленно, по-человечески, проверяя dialog_handoff и т.п.
 *
 * body: { targets: Array<{channel_id, target: string, target_kind: 'group'|'tg'|'vk'}>, scheduled_at? }
 * Если variant_ids пустой → используем все варианты кампании.
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

    type Tgt = { target: string; target_kind?: string };
    const targetsRaw = Array.isArray(body?.targets) ? body.targets as Tgt[] : [];
    const targets = targetsRaw
      .map((t) => ({
        target: String(t?.target ?? '').trim(),
        target_kind: ['group', 'tg', 'vk'].includes(String(t?.target_kind))
          ? String(t.target_kind)
          : 'group',
      }))
      .filter((t) => t.target);
    if (!targets.length) {
      return NextResponse.json({ error: 'targets обязателен (массив целей)' }, { status: 400 });
    }
    const scheduledAt = body?.scheduled_at != null ? String(body.scheduled_at) : null;

    const supabase = await createClient();

    // Все варианты кампании (только не-rejected)
    const { data: variants, error: vErr } = await supabase
      .from('ad_variants')
      .select('id, label')
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId);
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
    if (!variants?.length) {
      return NextResponse.json(
        { error: 'У кампании нет A/B-вариантов — добавь хотя бы один.' },
        { status: 400 }
      );
    }

    // Cross-product: variant × target — каждая цель получает ВСЕ варианты
    // (по директиве Sergey 2026-06-03). Для классического A/B-сплита
    // фронтенд может попросить выбрать конкретный variant_id вместо «все».
    type JobInsert = {
      tenant_id: string;
      campaign_id: string;
      variant_id: string;
      target_kind: string;
      target: string;
      status: string;
      scheduled_at: string | null;
    };
    const jobs: JobInsert[] = [];
    for (const v of variants) {
      for (const t of targets) {
        jobs.push({
          tenant_id: tenantId,
          campaign_id: campaignId,
          variant_id: v.id,
          target_kind: t.target_kind,
          target: t.target,
          status: 'queued',
          scheduled_at: scheduledAt,
        });
      }
    }

    // Bulk insert чанками по 500 (PostgREST лимиты).
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < jobs.length; i += CHUNK) {
      const slice = jobs.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from('mailing_jobs')
        .insert(slice, { count: 'exact' });
      if (error) return NextResponse.json({ error: error.message, inserted }, { status: 500 });
      inserted += count ?? slice.length;
    }

    return NextResponse.json({
      ok: true,
      inserted,
      variants: variants.length,
      targets: targets.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

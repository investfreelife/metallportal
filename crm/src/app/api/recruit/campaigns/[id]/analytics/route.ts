import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recruit/campaigns/[id]/analytics
 *
 * Аналитика по A/B-вариантам кампании:
 *   • variants — [{id, label, utm, sent_count, leads}] где leads =
 *     contacts where source=utm
 *   • by_status — распределение mailing_jobs по статусам
 *   • by_channel — по каналам (target) сколько лидов (через variant.utm
 *     не отделяется на каналы, поэтому считаем sent/failed jobs per target)
 *   • winner — variant с лучшей конверсией (leads / sent_count, либо
 *     просто leads если sent_count=0)
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id: campaignId } = await ctx.params;

    const supabase = await createClient();

    const { data: variants, error: vErr } = await supabase
      .from('ad_variants')
      .select('id, label, utm, sent_count')
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId);
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

    const { data: jobs } = await supabase
      .from('mailing_jobs')
      .select('id, variant_id, target, target_kind, status')
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId)
      .limit(5000);

    // Считаем contacts по source=utm — одним запросом на все utms.
    const utms = (variants ?? []).map((v) => v.utm).filter((x): x is string => !!x);
    let leadsByUtm: Record<string, number> = {};
    if (utms.length) {
      const { data: leads } = await supabase
        .from('contacts')
        .select('source')
        .eq('tenant_id', tenantId)
        .in('source', utms);
      for (const c of leads ?? []) {
        const s = (c as { source: string }).source;
        if (s) leadsByUtm[s] = (leadsByUtm[s] ?? 0) + 1;
      }
    }

    type VStat = {
      id: string; label: string | null; utm: string | null;
      sent_count: number; leads: number; conv: number; jobs_sent: number; jobs_failed: number;
    };
    const variantStats: VStat[] = (variants ?? []).map((v) => {
      const myJobs = (jobs ?? []).filter((j) => j.variant_id === v.id);
      const jobs_sent = myJobs.filter((j) => j.status === 'sent').length;
      const jobs_failed = myJobs.filter((j) => j.status === 'failed').length;
      const sent_count = v.sent_count ?? jobs_sent;
      const leads = leadsByUtm[v.utm ?? ''] ?? 0;
      const conv = sent_count > 0 ? leads / sent_count : 0;
      return {
        id: v.id, label: v.label, utm: v.utm,
        sent_count, leads, conv, jobs_sent, jobs_failed,
      };
    });

    // by_status:
    const byStatus: Record<string, number> = { queued: 0, sent: 0, failed: 0, skipped: 0 };
    for (const j of jobs ?? []) {
      const s = (j.status ?? 'queued').toString();
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    // by_channel top-10 целей по числу jobs (для понимания, куда летим):
    const byChannelMap = new Map<string, { target: string; total: number; sent: number; failed: number }>();
    for (const j of jobs ?? []) {
      const t = (j.target ?? '').toString();
      if (!t) continue;
      const x = byChannelMap.get(t) ?? { target: t, total: 0, sent: 0, failed: 0 };
      x.total += 1;
      if (j.status === 'sent') x.sent += 1;
      if (j.status === 'failed') x.failed += 1;
      byChannelMap.set(t, x);
    }
    const byChannel = Array.from(byChannelMap.values()).sort((a, b) => b.total - a.total).slice(0, 20);

    // Winner: максимум conv; если conv везде 0 — leads; иначе null.
    let winner: VStat | null = null;
    for (const v of variantStats) {
      if (!winner) { winner = v; continue; }
      if (v.conv > winner.conv) winner = v;
      else if (v.conv === winner.conv && v.leads > winner.leads) winner = v;
    }
    if (winner && winner.leads === 0 && winner.sent_count === 0) winner = null;

    return NextResponse.json({
      variants: variantStats,
      by_status: byStatus,
      by_channel: byChannel,
      winner_variant_id: winner?.id ?? null,
      totals: {
        variants: variantStats.length,
        jobs: jobs?.length ?? 0,
        leads: Object.values(leadsByUtm).reduce((s, v) => s + v, 0),
        sent: byStatus.sent,
        failed: byStatus.failed,
        queued: byStatus.queued,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

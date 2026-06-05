import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/marketing-plan/posts — список маркетинг-постов tenant'а.
 * Query:
 *   ?status=approved|scheduled|published|draft|ready|revise|... (опц.)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD (опц., по scheduled_at)
 *   ?campaign_id=<uuid> (опц., посты конкретной кампании-сегмента)
 *
 * Sergey directive 2026-06-04, task 050: копия /api/content/posts с
 * заменой источника на ad_variants. Кампания (campaigns) — аналог темы.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const campaignId = url.searchParams.get('campaign_id');

  let q = supabase
    .from('ad_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('scheduled_at', from);
  if (to) q = q.lte('scheduled_at', to);
  if (campaignId) q = q.eq('campaign_id', campaignId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

/**
 * POST /api/marketing-plan/posts — создать маркетинг-пост (черновик).
 * body: { label?, text?, campaign_id?, channel?, scheduled_at?, utm? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const { label, text, campaign_id, channel, scheduled_at, utm } = body;

  const { data, error } = await supabase
    .from('ad_variants')
    .insert({
      tenant_id: tenantId,
      label: label || null,
      text: text || null,
      campaign_id: campaign_id || null,
      channel: channel || null,
      scheduled_at: scheduled_at || null,
      utm: utm || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

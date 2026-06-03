import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/content/posts — список постов tenant'а (по сессии).
 * Query: ?status=scheduled|published|draft|... (опционально, фильтр)
 *        ?from=YYYY-MM-DD&to=YYYY-MM-DD (опц., по scheduled_at)
 *
 * Sergey directive 2026-06-03 — calendar планировщик, замена Postiz.
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

  let q = supabase
    .from('content_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('scheduled_at', from);
  if (to) q = q.lte('scheduled_at', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

/**
 * POST /api/content/posts — создать пост (черновик).
 * body: { title?, body?, photo_tz?, channel?, scheduled_at? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const { title, body: text, photo_tz, channel, scheduled_at } = body;

  const { data, error } = await supabase
    .from('content_posts')
    .insert({
      tenant_id: tenantId,
      title: title || null,
      body: text || null,
      photo_tz: photo_tz || null,
      channel: channel || null,
      scheduled_at: scheduled_at || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

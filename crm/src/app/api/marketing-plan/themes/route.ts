import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/marketing-plan/themes — список кампаний tenant'а как «тем»
 * маркетинг-плана. Кампания (campaigns) — аналог content_themes.
 *
 * Сорт: seg_order ASC nulls LAST, created_at ASC.
 * Query: ?status=draft|active|paused|done (опц.)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let q = supabase
    .from('campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('seg_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ themes: data ?? [] });
}

/**
 * POST /api/marketing-plan/themes — добавить кампанию вручную.
 * body: { name, objective?, audience?, segment?, portrait?, seg_order?, status? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const body = await req.json().catch(() => ({}));
  const { name, objective, audience, segment, portrait, seg_order, status } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name обязателен' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      objective: objective?.trim() || null,
      audience: audience?.trim() || null,
      segment: segment?.trim() || null,
      portrait: portrait?.trim() || null,
      seg_order: typeof seg_order === 'number' ? seg_order : null,
      status: status || 'draft',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ theme: data });
}

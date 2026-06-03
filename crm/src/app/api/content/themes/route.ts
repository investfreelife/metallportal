import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/content/themes — список тем контент-плана tenant'а.
 * Сорт: rubric ASC, priority DESC, created_at ASC.
 * Query: ?status=idea|drafted|rejected (опц.)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let q = supabase
    .from('content_themes')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('rubric', { ascending: true })
    .order('priority', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ themes: data ?? [] });
}

/**
 * POST /api/content/themes — добавить тему вручную.
 * body: { rubric, title, idea?, priority?, status? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const body = await req.json().catch(() => ({}));
  const { rubric, title, idea, priority, status } = body;

  if (!rubric?.trim() || !title?.trim()) {
    return NextResponse.json({ error: 'rubric и title обязательны' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_themes')
    .insert({
      tenant_id: tenantId,
      rubric: rubric.trim(),
      title: title.trim(),
      idea: idea?.trim() || null,
      priority: typeof priority === 'number' ? priority : null,
      status: status || 'idea',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ theme: data });
}

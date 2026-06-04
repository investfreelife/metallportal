import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * /api/recruit/campaigns — маркетинговые кампании (campaigns table).
 * GET — список tenant'а
 * POST {name, objective?, audience?, status?} — создать
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name, objective, audience, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campaigns: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));

    const name = String(body.name ?? '').trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: 'name обязателен' }, { status: 400 });
    const objective = body.objective != null ? String(body.objective).trim().slice(0, 200) : null;
    const audience = body.audience != null ? String(body.audience).trim().slice(0, 500) : null;
    const status = body.status ? String(body.status).trim().slice(0, 40) : 'draft';

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ tenant_id: tenantId, name, objective, audience, status })
      .select('id, name, objective, audience, status, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campaign: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

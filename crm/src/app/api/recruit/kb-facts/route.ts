import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * /api/recruit/kb-facts — база знаний бота.
 * GET: список фактов tenant'а (опц. ?q= поиск).
 * POST: ручное добавление {question, answer}.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const search = req.nextUrl.searchParams.get('q')?.trim();

    const supabase = await createClient();
    let q = supabase
      .from('kb_facts')
      .select('id, question, answer, added_by, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (search) {
      // ilike-OR через .or() — экранируем %_, кавычки в строке.
      const safe = search.replace(/[%_]/g, (m) => `\\${m}`);
      q = q.or(`question.ilike.%${safe}%,answer.ilike.%${safe}%`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ facts: data ?? [] });
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
    const question = String(body.question ?? '').trim();
    const answer = String(body.answer ?? '').trim();
    const addedBy = (body.added_by || session.login || session.name || 'admin').toString().slice(0, 120);

    if (!question || !answer) {
      return NextResponse.json({ error: 'question и answer обязательны' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('kb_facts')
      .insert({ tenant_id: tenantId, question, answer, added_by: addedBy })
      .select('id, question, answer, added_by, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ fact: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * /api/recruit/command — окно «Обратиться к мозгу» в дашборде.
 *
 * Sergey directive 2026-06-04: внизу любой страницы есть поле, куда
 * пишешь «поставь даты постам / проверь воронку / добавь факт…» —
 * локальный демон (НЕ CRM) подхватывает crm_commands WHERE status='new',
 * выполняет и пишет {response, status:'done'|'error'}.
 *
 * POST {page, text}    — создать команду
 * GET  ?id=<uuid>      — статус/ответ
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));
    const page = String(body.page ?? '').trim().slice(0, 200) || '/';
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'text обязателен' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_commands')
      .insert({
        tenant_id: tenantId,
        page,
        text: text.slice(0, 4000),
        status: 'new',
      })
      .select('id, page, text, status, response, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ command: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const id = req.nextUrl.searchParams.get('id');
    const page = req.nextUrl.searchParams.get('page');

    const supabase = await createClient();
    if (id) {
      const { data, error } = await supabase
        .from('crm_commands')
        .select('id, page, text, status, response, created_at, done_at')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
      return NextResponse.json({ command: data });
    }

    // История по странице (последние 3 done/error)
    let q = supabase
      .from('crm_commands')
      .select('id, page, text, status, response, created_at, done_at')
      .eq('tenant_id', tenantId)
      .in('status', ['done', 'error'])
      .order('created_at', { ascending: false })
      .limit(3);
    if (page) q = q.eq('page', page);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ history: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

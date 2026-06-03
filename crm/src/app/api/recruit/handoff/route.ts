import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * /api/recruit/handoff
 *
 * Перехват диалога живым человеком — Сергей берёт чат на себя,
 * AI/VK-демон обязан замолчать, пока active=true.
 *
 * Таблица dialog_handoff(tenant_id, chat_id, taken_by, active, created_at)
 * с pk(tenant_id, chat_id). UPSERT по pk.
 *
 * GET ?chat_id=... → {active, taken_by, since}
 * POST {chat_id, active, taken_by?} → upsert; taken_by по умолчанию = login сессии.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const chatId = req.nextUrl.searchParams.get('chat_id');
    if (!chatId) return NextResponse.json({ error: 'chat_id обязателен' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('dialog_handoff')
      .select('taken_by, active, created_at')
      .eq('tenant_id', tenantId)
      .eq('chat_id', chatId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      active: !!data?.active,
      taken_by: data?.taken_by ?? null,
      since: data?.created_at ?? null,
    });
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
    const chatId = String(body.chat_id ?? '').trim();
    const active = Boolean(body.active);
    const takenBy = (body.taken_by || session.login || session.name || 'admin').toString().slice(0, 120);

    if (!chatId) return NextResponse.json({ error: 'chat_id обязателен' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('dialog_handoff')
      .upsert(
        {
          tenant_id: tenantId,
          chat_id: chatId,
          taken_by: active ? takenBy : null,
          active,
          // created_at обновляем каждый раз — это «когда человек взял/вернул».
          created_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,chat_id' }
      )
      .select('taken_by, active, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      active: !!data?.active,
      taken_by: data?.taken_by ?? null,
      since: data?.created_at ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/dialogs/[chat_id]
 *
 * Полная лента сообщений выбранного диалога + текущее состояние handoff.
 * Сорт: created_at ASC.
 *
 * BUG-фикс 2026-06-03: при chat_id со спецсимволами (например VK = «vk:469863452»,
 * двоеточие в URL) роут падал и Next возвращал HTML-ошибку, фронт ломался на
 * res.json() с «Unexpected token '<'». Теперь:
 *   • явно decodeURIComponent на param;
 *   • try/catch вокруг ВСЕЙ логики, любая ошибка → NextResponse.json({error}).
 *   • dynamic = 'force-dynamic' чтобы Next не пытался prerender.
 *
 * Tenant-scoped: anti-IDOR через .eq('tenant_id', tenantId).
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ chat_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = await getTenantId();
    const { chat_id: rawChatId } = await ctx.params;

    // Next.js обычно сам декодирует, но на ряде edge-runtime сценариев может
    // прилететь сырой % escape — добавим явный safe-decode, иначе .eq не матчнется.
    let chatId = rawChatId;
    try {
      // если уже decoded — decodeURIComponent просто не упадёт
      chatId = decodeURIComponent(rawChatId);
    } catch {
      // оставим как есть
    }

    if (!chatId) {
      return NextResponse.json({ error: 'chat_id обязателен' }, { status: 400 });
    }

    const supabase = await createClient();

    const [{ data: messages, error: mErr }, { data: handoff, error: hErr }] = await Promise.all([
      supabase
        .from('dialog_messages')
        .select('id, chat_id, who, username, direction, text, stage, created_at')
        .eq('tenant_id', tenantId)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(2000),
      supabase
        .from('dialog_handoff')
        .select('taken_by, active, created_at')
        .eq('tenant_id', tenantId)
        .eq('chat_id', chatId)
        .maybeSingle(),
    ]);

    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }
    // hErr на handoff — не критично, лог в консоль, но запрос не валим.
    if (hErr) console.error('[dialogs/[chat_id]] handoff query err:', hErr.message);

    return NextResponse.json({
      messages: messages ?? [],
      handoff: handoff
        ? { active: !!handoff.active, taken_by: handoff.taken_by, since: handoff.created_at }
        : { active: false, taken_by: null, since: null },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/recruit/dialogs/[chat_id]] fatal:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

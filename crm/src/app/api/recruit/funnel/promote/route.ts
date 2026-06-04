import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * POST /api/recruit/funnel/promote
 *
 * Перевод кандидата из воронки в действующие водители:
 *   • найти/создать contacts по chat_id (telegram_chat_id или telegram)
 *   • поставить type='driver', status='active'
 *   • вставить запись dialog_messages со stage='on_line' (direction='out',
 *     who='система', text='Переведён в действующие водители')
 *
 * Идемпотентно: если type уже 'driver' AND status='active' — no-op
 * (вернёт reused=true).
 *
 * body: { chat_id }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));
    const chatId = String(body.chat_id ?? '').trim();
    if (!chatId) return NextResponse.json({ error: 'chat_id обязателен' }, { status: 400 });

    const supabase = await createClient();

    // ── 1. Достанем имя/username из dialog_messages ─────────────────
    const { data: msgs } = await supabase
      .from('dialog_messages')
      .select('who, username')
      .eq('tenant_id', tenantId)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(50);

    let who: string | null = null;
    let username: string | null = null;
    for (const m of msgs ?? []) {
      if (!who && m.who) who = m.who;
      if (!username && m.username) username = m.username;
      if (who && username) break;
    }
    if (!who && !username) who = `чат ${chatId}`;

    // ── 2. Найдём контакт: сначала по telegram_chat_id, потом по telegram ─
    const tgUsernameNorm = username ? `@${String(username).replace(/^@/, '').toLowerCase()}` : null;
    const isVk = chatId.toLowerCase().startsWith('vk:');
    const isNumeric = /^-?\d+$/.test(chatId);

    let contact: { id: string; type: string | null; status: string | null } | null = null;

    if (isNumeric) {
      const { data } = await supabase
        .from('contacts')
        .select('id, type, status')
        .eq('tenant_id', tenantId)
        .eq('telegram_chat_id', chatId)
        .maybeSingle();
      contact = data;
    }

    if (!contact && tgUsernameNorm) {
      const { data } = await supabase
        .from('contacts')
        .select('id, type, status')
        .eq('tenant_id', tenantId)
        .ilike('telegram', tgUsernameNorm)
        .maybeSingle();
      contact = data;
    }

    if (!contact && isVk) {
      // VK без удобного field в contacts — попробуем metadata->>vk_user_id
      const vkId = chatId.slice(3);
      const { data } = await supabase
        .from('contacts')
        .select('id, type, status')
        .eq('tenant_id', tenantId)
        .eq('metadata->>vk_user_id', vkId)
        .maybeSingle();
      contact = data;
    }

    let createdNew = false;
    let reused = false;

    if (contact) {
      // Если уже водитель — idempotent.
      if (contact.type === 'driver' && contact.status === 'active') {
        reused = true;
      } else {
        await supabase
          .from('contacts')
          .update({
            type: 'driver',
            status: 'active',
            last_contact_at: new Date().toISOString(),
          })
          .eq('id', contact.id)
          .eq('tenant_id', tenantId);
      }
    } else {
      const insertPayload: Record<string, unknown> = {
        tenant_id: tenantId,
        full_name: who ?? username ?? `Кандидат ${chatId}`,
        type: 'driver',
        status: 'active',
        source: isVk ? 'vk' : isNumeric ? 'tg_bot' : 'manual',
        last_contact_at: new Date().toISOString(),
      };
      if (tgUsernameNorm) insertPayload.telegram = tgUsernameNorm;
      if (isNumeric) insertPayload.telegram_chat_id = chatId;
      if (isVk) insertPayload.metadata = { vk_user_id: chatId.slice(3) };

      const { data: created, error: cErr } = await supabase
        .from('contacts')
        .insert(insertPayload)
        .select('id')
        .single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      contact = { id: created.id, type: 'driver', status: 'active' };
      createdNew = true;
    }

    // ── 3. Вставка dialog_messages со stage='on_line' (если не reused) ─
    if (!reused) {
      const by = session.login || session.name || 'admin';
      await supabase.from('dialog_messages').insert({
        tenant_id: tenantId,
        chat_id: chatId,
        who: by,
        username: null,
        direction: 'out',
        text: `Переведён в действующие водители (${by})`,
        stage: 'on_line',
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      contact_id: contact?.id ?? null,
      created: createdNew,
      reused,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { randomUUID } from 'crypto';

/**
 * POST /api/recruit/funnel/add
 *
 * Ручное добавление кандидата в воронку.
 *
 * body:
 *   contact_id?  — UUID существующего contacts (если выбран в селекте)
 *   full_name    — обязательно (если contact_id не дан)
 *   phone?
 *   telegram?    — @username или t.me/ ссылка
 *   telegram_chat_id?
 *   source       — 'tg' | 'vk' | 'personal' | 'other'
 *   transport    — 'auto' | 'bike' | 'foot' | 'other'
 *   stage        — 'new' | 'engaged' | 'wants' | 'docs' | 'on_line'
 *   comment?     — текст первой записи в dialog_messages
 *
 * Создаёт/обновляет contacts и вставляет ПЕРВУЮ запись в
 * dialog_messages (direction='in', stage), чтобы кандидат появился
 * в воронке. chat_id:
 *   - если telegram_chat_id (число) → используем как есть (это TG)
 *   - иначе если есть telegram (@username) → 'tg:' + username
 *   - иначе manual:<uuid> (для ручных без идентификатора)
 */
export const dynamic = 'force-dynamic';

interface Body {
  contact_id?: string;
  full_name?: string;
  phone?: string;
  telegram?: string;
  telegram_chat_id?: string;
  source?: string;
  transport?: string;
  stage?: string;
  comment?: string;
}

const ALLOWED_STAGE = new Set(['new', 'engaged', 'wants', 'docs', 'on_line', 'rejected']);
const ALLOWED_SOURCE = new Set(['tg', 'vk', 'personal', 'other']);
const ALLOWED_TRANSPORT = new Set(['auto', 'bike', 'foot', 'other']);

function normTelegram(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
  return t ? `@${t.slice(0, 60)}` : null;
}

function buildChatId(opts: {
  telegram_chat_id?: string | null;
  telegram?: string | null;
}): string {
  const tcid = opts.telegram_chat_id?.toString().trim();
  if (tcid && /^-?\d+$/.test(tcid)) return tcid; // TG numeric id
  const tg = normTelegram(opts.telegram);
  if (tg) return `tg:${tg.replace(/^@/, '')}`;
  return `manual:${randomUUID()}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = (await req.json().catch(() => ({}))) as Body;

    const source = ALLOWED_SOURCE.has(body.source ?? '') ? body.source! : 'other';
    const transport = ALLOWED_TRANSPORT.has(body.transport ?? '') ? body.transport! : 'auto';
    const stage = ALLOWED_STAGE.has(body.stage ?? '') ? body.stage! : 'new';
    const comment = (body.comment ?? '').toString().trim();

    const supabase = await createClient();

    // ── 1. Контакт ──────────────────────────────────────────────────
    let contactId: string | null = null;
    let contactName: string | null = null;
    let chatIdFromContact: string | null = null;
    let telegramUsername: string | null = null;

    if (body.contact_id) {
      const { data: existing, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, telegram, telegram_chat_id, source, type')
        .eq('id', body.contact_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!existing) return NextResponse.json({ error: 'Контакт не найден' }, { status: 404 });

      contactId = existing.id;
      contactName = existing.full_name;
      chatIdFromContact = existing.telegram_chat_id || (existing.telegram ? `tg:${String(existing.telegram).replace(/^@/, '')}` : null);
      telegramUsername = existing.telegram;
    } else {
      const fullName = (body.full_name ?? '').toString().trim();
      if (!fullName) {
        return NextResponse.json({ error: 'full_name обязателен (или contact_id)' }, { status: 400 });
      }
      const phone = (body.phone ?? '').toString().trim() || null;
      const tg = normTelegram(body.telegram);
      const tgcid = (body.telegram_chat_id ?? '').toString().trim() || null;

      // Метим как кандидат на водителя; transport кладём в tags + metadata
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenantId,
          full_name: fullName.slice(0, 200),
          phone: phone?.slice(0, 60),
          telegram: tg,
          telegram_chat_id: tgcid,
          type: 'driver_candidate',
          status: stage === 'on_line' ? 'active' : 'new',
          source,
          tags: [`transport:${transport}`],
          notes: comment || null,
        })
        .select('id, full_name, telegram, telegram_chat_id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      contactId = created.id;
      contactName = created.full_name;
      chatIdFromContact = created.telegram_chat_id || (created.telegram ? `tg:${String(created.telegram).replace(/^@/, '')}` : null);
      telegramUsername = created.telegram;
    }

    // ── 2. chat_id для dialog_messages ──────────────────────────────
    const chatId = chatIdFromContact || buildChatId({
      telegram_chat_id: body.telegram_chat_id,
      telegram: telegramUsername || body.telegram,
    });

    // ── 3. Первая запись в dialog_messages ──────────────────────────
    const nowIso = new Date().toISOString();
    const text = comment || `Добавлен вручную (${transport}, ${source})`;
    const { error: msgErr } = await supabase
      .from('dialog_messages')
      .insert({
        tenant_id: tenantId,
        chat_id: chatId,
        who: contactName,
        username: telegramUsername?.replace(/^@/, '') ?? null,
        direction: 'in',
        text,
        stage,
        created_at: nowIso,
      });
    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      contact_id: contactId,
      chat_id: chatId,
      stage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/funnel
 *
 * Кандидаты сгруппированы по chat_id; стадия = последняя стадия в
 * dialog_messages (если null — «new»). Источник вытаскивается из
 * префикса chat_id (vk:* → vk, иначе → telegram).
 *
 * BUG-фикс 2026-06-03: раньше воронка читала contacts.status — там у
 * Столицы было пусто, поэтому колонки оставались пустыми. Теперь
 * источник — агрегат dialog_messages.
 *
 * Возвращает массив FunnelItem: chat_id, who, username, stage, source,
 * last_text, last_at, msg_count.
 */
export const dynamic = 'force-dynamic';

export interface FunnelItem {
  chat_id: string;
  who: string | null;
  username: string | null;
  stage: string;             // 'new' если null в БД
  source: string;            // 'vk' | 'telegram' | 'other'
  last_text: string | null;
  last_at: string;
  msg_count: number;
}

function detectSource(chat_id: string): string {
  const lower = chat_id.toLowerCase();
  if (lower.startsWith('vk:')) return 'vk';
  // Telegram chat_id всегда числовой (или -100… для каналов)
  if (/^-?\d+$/.test(chat_id)) return 'telegram';
  if (lower.startsWith('tg:') || lower.startsWith('telegram:')) return 'telegram';
  return 'other';
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('dialog_messages')
      .select('chat_id, who, username, direction, text, stage, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Группировка: первая встретившаяся (DESC) для chat_id — это «последнее»
    // сообщение, оно даёт last_at, last_text, stage. Дальше копим msg_count
    // и сохраняем who/username/stage если первая встреча не имела значения.
    const map = new Map<string, FunnelItem>();
    for (const m of data ?? []) {
      if (!m.chat_id) continue;
      const existing = map.get(m.chat_id);
      if (!existing) {
        map.set(m.chat_id, {
          chat_id: m.chat_id,
          who: m.who,
          username: m.username,
          stage: m.stage || 'new',
          source: detectSource(m.chat_id),
          last_text: m.text,
          last_at: m.created_at,
          msg_count: 1,
        });
      } else {
        existing.msg_count += 1;
        if (!existing.who && m.who) existing.who = m.who;
        if (!existing.username && m.username) existing.username = m.username;
        // если в последних сообщениях stage был null, но более старое сообщение
        // имеет stage — используем его (но не перетираем уже найденное).
        if (existing.stage === 'new' && m.stage) existing.stage = m.stage;
      }
    }

    const items = Array.from(map.values()).sort(
      (a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0)
    );

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

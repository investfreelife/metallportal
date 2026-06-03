import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import type { DialogMessage, DialogSummary } from '@/lib/recruit/types';

/**
 * GET /api/recruit/dialogs
 *
 * Список диалогов tenant'а — по одной записи на chat_id, с последним
 * сообщением, счётчиком, текущим stage. Сорт: последний контакт DESC.
 *
 * NB: dialog_messages — это лог event'ов (каждое сообщение бот↔кандидат).
 * Группировку считаем здесь в JS: тянем последние N сообщений (5000)
 * и проходим по ним. Объём низкий — кандидаты Столицы, не миллион строк.
 * Для масштаба позже — материализуем view либо table dialog_summaries.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dialog_messages')
    .select('id, chat_id, who, username, direction, text, stage, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Pick<DialogMessage, 'id' | 'chat_id' | 'who' | 'username' | 'direction' | 'text' | 'stage' | 'created_at'>[];

  // Группируем по chat_id, оставляя самое свежее сообщение как "last".
  const map = new Map<string, DialogSummary>();
  for (const m of rows) {
    if (!m.chat_id) continue;
    const existing = map.get(m.chat_id);
    if (!existing) {
      map.set(m.chat_id, {
        chat_id: m.chat_id,
        who: m.who,
        username: m.username,
        stage: m.stage,
        last_text: m.text,
        last_at: m.created_at,
        last_direction: (m.direction === 'out' ? 'out' : 'in'),
        msg_count: 1,
      });
    } else {
      existing.msg_count += 1;
      // m идёт от свежих к старым; first hit это «last», stage обновляем
      // если в новейшем сообщении он был задан а в существующем — нет
      if (!existing.stage && m.stage) existing.stage = m.stage;
      if (!existing.who && m.who) existing.who = m.who;
      if (!existing.username && m.username) existing.username = m.username;
    }
  }

  const dialogs = Array.from(map.values()).sort(
    (a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0)
  );

  return NextResponse.json({ dialogs, total_messages: rows.length });
}

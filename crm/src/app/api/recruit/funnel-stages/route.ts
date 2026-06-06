import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { isActiveStage, type FunnelContact, type FunnelStage } from '@/lib/recruit/stages';

/**
 * GET /api/recruit/funnel-stages
 *
 * Канбан-вью воронки по полной модели стадий (Task 056).
 * Источник: contacts (расширенные колонки) + последний dialog_messages
 * по telegram_chat_id (для превью последней реплики).
 *
 * Возвращает:
 *   {
 *     contacts: FunnelContact[],
 *     red: {
 *       missing_next_touch: string[],   // id с активной стадией и пустым next_touch_at
 *       agreed_over_4h: string[],       // agreed без движения 4ч+
 *       promise_overdue: string[],      // обещание (promises[].status!='done') старше 24ч
 *       new_no_reply: string[],         // new без out-сообщения
 *     },
 *     summary: { [stage]: number },
 *   }
 *
 * PATCH /api/recruit/funnel-stages
 *   { id, stage?, next_touch_at?, objections?, promises?, ready_date?,
 *     lost_reason?, do_not_contact?, segment?, city?, has_car?, experience? }
 *   — белый список + tenant-scoped + проверка canMoveTo() для stage.
 */
export const dynamic = 'force-dynamic';

interface ContactRow {
  id: string;
  full_name: string | null;
  telegram_chat_id: string | null;
  stage: string | null;
  segment: string | null;
  city: string | null;
  has_car: boolean | null;
  next_touch_at: string | null;
  touch_count: number | null;
  last_direction: string | null;
  objections: Array<Record<string, unknown>> | null;
  promises: Array<Record<string, unknown>> | null;
  ready_date: string | null;
  lost_reason: string | null;
  do_not_contact: boolean | null;
  source: string | null;
  source_code: string | null;
  entry_segment: string | null;
  human_locked: boolean | null;
  created_at: string;
}

interface DmRow {
  chat_id: string;
  direction: string | null;
  text: string | null;
  created_at: string;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();

    const { data: contacts, error: cErr } = await supabase
      .from('contacts')
      .select('id, full_name, telegram_chat_id, stage, segment, city, has_car, next_touch_at, touch_count, last_direction, objections, promises, ready_date, lost_reason, do_not_contact, source, source_code, entry_segment, human_locked, created_at')
      .eq('tenant_id', tenantId)
      .eq('type', 'driver_candidate')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    const rows = (contacts ?? []) as ContactRow[];
    const chatIds = rows.map((r) => r.telegram_chat_id).filter((x): x is string => !!x);

    // Последний dialog_messages per chat_id — для превью.
    const lastByChat = new Map<string, DmRow>();
    if (chatIds.length) {
      const { data: dms } = await supabase
        .from('dialog_messages')
        .select('chat_id, direction, text, created_at')
        .eq('tenant_id', tenantId)
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false })
        .limit(5000);
      for (const m of (dms ?? []) as DmRow[]) {
        if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
      }
    }

    const enriched: FunnelContact[] = rows.map((r) => {
      const dm = r.telegram_chat_id ? lastByChat.get(r.telegram_chat_id) : null;
      return {
        ...r,
        stage: (r.stage as FunnelStage) ?? 'new',
        last_text: dm?.text ?? null,
        last_at: dm?.created_at ?? null,
      };
    });

    // ── Красная панель ─────────────────────────────────────────────────
    const nowMs = Date.now();
    const H4 = 4 * 3600_000;
    const H24 = 24 * 3600_000;

    const missing_next_touch: string[] = [];
    const agreed_over_4h: string[] = [];
    const promise_overdue: string[] = [];
    const new_no_reply: string[] = [];

    for (const c of enriched) {
      // 1. активная стадия + пустой next_touch_at
      if (isActiveStage(c.stage as string) && !c.next_touch_at) {
        missing_next_touch.push(c.id);
      }
      // 2. agreed старше 4 ч (по last_at или created_at)
      if (c.stage === 'agreed') {
        const t = c.last_at ?? c.created_at;
        if (t && nowMs - new Date(t).getTime() > H4) agreed_over_4h.push(c.id);
      }
      // 3. обещание не done старше 24 ч
      const promises = Array.isArray(c.promises) ? c.promises : [];
      for (const p of promises) {
        const status = String((p as Record<string, unknown>).status ?? '');
        const when = (p as Record<string, unknown>).at ?? (p as Record<string, unknown>).created_at;
        if (status !== 'done' && typeof when === 'string') {
          if (nowMs - new Date(when).getTime() > H24) { promise_overdue.push(c.id); break; }
        }
      }
      // 4. new без out-сообщения (бот не успел ответить)
      if (c.stage === 'new') {
        const dm = c.telegram_chat_id ? lastByChat.get(c.telegram_chat_id) : null;
        if (!dm || dm.direction !== 'out') new_no_reply.push(c.id);
      }
    }

    // Сводка по стадиям
    const summary: Record<string, number> = {};
    for (const c of enriched) {
      const s = (c.stage as string) || 'new';
      summary[s] = (summary[s] ?? 0) + 1;
    }

    return NextResponse.json({
      contacts: enriched,
      red: { missing_next_touch, agreed_over_4h, promise_overdue, new_no_reply },
      summary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const ALLOWED = new Set([
  'stage', 'next_touch_at', 'touch_count', 'last_direction',
  'objections', 'promises', 'ready_date', 'lost_reason',
  'do_not_contact', 'segment', 'city', 'has_car', 'experience',
  'reactivate_at', 'human_locked',
]);

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'id') continue;
      if (ALLOWED.has(k)) patch[k] = v;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
    }

    const supabase = await createClient();

    // Task 063+1: canMoveTo() убрана из API — Сергей-кодер: реальные кандидаты
    // ходят туда-сюда (например, agreed→engaged когда передумали), запрет
    // мешал работе. UI больше тоже не подтверждает откаты на drag-drop.

    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    return NextResponse.json({ contact: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

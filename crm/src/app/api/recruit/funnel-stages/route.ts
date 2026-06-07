import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { isActiveStage, type FunnelContact, type FunnelStage } from '@/lib/recruit/stages';

/**
 * GET /api/recruit/funnel-stages
 *
 * ТЗ-077: Источник лидов = contacts ∪ dialog_messages (не теряем тех, у кого
 * есть диалог но нет контакта). Стадия — `contacts.stage` если задана,
 * иначе деривация из последнего `dialog_messages.stage` чата.
 * Спам/реклама/тесты — НЕ лиды (исключаются из воронки).
 *
 * Query:
 *   period = today|week|month|year|all (default: month)
 *   from, to — ISO даты для period=custom (или замещают period)
 *   include_spam = 1 — показать спам/тесты в ответе (отдельный набор для UI-вкладки)
 *
 * Response:
 *   {
 *     contacts: FunnelContact[]     — лиды без спама/тестов
 *     spam:     FunnelContact[]     — для отдельной вкладки (если include_spam=1)
 *     red:      { ... }             — красная панель (только по contacts)
 *     summary:  { [stage]: number } — по contacts
 *     period:   { key, from, to }
 *     total:    number              — лиды без спама/тестов в выбранном периоде
 *   }
 *
 * PATCH /api/recruit/funnel-stages — без изменений (whitelist + tenant-scoped).
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
  id: string;
  chat_id: string;
  who: string | null;
  username: string | null;
  direction: string | null;
  text: string | null;
  stage: string | null;
  created_at: string;
}

/* ─────────────────────────────────────────────────────────────────
 *  Period parsing — Сегодня/Неделя/Месяц/Год/All/Custom
 * ───────────────────────────────────────────────────────────────── */
function parsePeriod(sp: URLSearchParams): { key: string; from: Date | null; to: Date | null } {
  const customFrom = sp.get('from');
  const customTo = sp.get('to');
  if (customFrom || customTo) {
    return {
      key: 'custom',
      from: customFrom ? new Date(customFrom) : null,
      to: customTo ? new Date(customTo) : null,
    };
  }
  const period = (sp.get('period') ?? 'month').toLowerCase();
  const now = new Date();
  const startOfDayMsk = () => { const d = new Date(); d.setUTCHours(-3, 0, 0, 0); return d; }; // 00:00 МСК
  if (period === 'today') return { key: 'today', from: startOfDayMsk(), to: null };
  if (period === 'week')  return { key: 'week',  from: new Date(now.getTime() - 7 * 86400_000), to: null };
  if (period === 'month') return { key: 'month', from: new Date(now.getTime() - 30 * 86400_000), to: null };
  if (period === 'year')  return { key: 'year',  from: new Date(now.getTime() - 365 * 86400_000), to: null };
  return { key: 'all', from: null, to: null };
}

/* ─────────────────────────────────────────────────────────────────
 *  Derive stage из dialog_messages если contacts.stage пуст.
 *  ТЗ-077 §2: правила деривации.
 * ───────────────────────────────────────────────────────────────── */
const SPAM_STAGES = new Set(['spam', 'ad', 'spam_ad']);
const HANDOFF_MARK = /\[МЕНЕДЖЕР\]|\[MANAGER\]/i;

function deriveStageFromDms(dms: DmRow[]): { stage: FunnelStage; spam: boolean } {
  // dms отсортированы по created_at DESC (новые сверху).
  if (!dms.length) return { stage: 'new', spam: false };
  const last = dms[0];
  if (last.stage && SPAM_STAGES.has(last.stage)) return { stage: 'spam', spam: true };

  // Любое сообщение со стадией docs → docs (или маркер [МЕНЕДЖЕР])
  for (const m of dms) {
    if (m.stage === 'docs') return { stage: 'docs', spam: false };
    if (m.text && HANDOFF_MARK.test(m.text)) return { stage: 'docs', spam: false };
  }
  // Любое engaged → engaged
  for (const m of dms) {
    if (m.stage === 'engaged') return { stage: 'engaged', spam: false };
  }
  // Есть хоть одно out → contact (бот ответил)
  const hasOut = dms.some((m) => m.direction === 'out');
  return { stage: hasOut ? 'contact' : 'new', spam: false };
}

function isTest(c: ContactRow | null, who: string | null): boolean {
  const name = (c?.full_name ?? who ?? '').toLowerCase();
  return /\btest\b|^теst|^тест/i.test(name) || (c?.source ?? '') === 'test';
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;
    const period = parsePeriod(sp);
    const includeSpam = sp.get('include_spam') === '1';

    const supabase = await createClient();

    // 1. Contacts (с extended select). Не фильтруем по type — у мозга разные типы
    // ('driver_candidate' у одних, может быть пусто у других). Тенант — обязателен.
    const { data: contacts, error: cErr } = await supabase
      .from('contacts')
      .select('id, full_name, telegram_chat_id, stage, segment, city, has_car, next_touch_at, touch_count, last_direction, objections, promises, ready_date, lost_reason, do_not_contact, source, source_code, entry_segment, human_locked, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    const cRows = (contacts ?? []) as ContactRow[];

    // 2. ВСЕ dialog_messages — нужны для деривации стадии + first_at.
    const { data: dms, error: dmErr } = await supabase
      .from('dialog_messages')
      .select('id, chat_id, who, username, direction, text, stage, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20000);
    if (dmErr) return NextResponse.json({ error: dmErr.message }, { status: 500 });
    const dmRows = (dms ?? []) as DmRow[];

    // 3. Группировка DM по chat_id.
    const byChat = new Map<string, DmRow[]>();
    for (const m of dmRows) {
      if (!m.chat_id) continue;
      const arr = byChat.get(m.chat_id) ?? [];
      arr.push(m);
      byChat.set(m.chat_id, arr);
    }

    // 4. Union по chat_id: каждый chat → один «лид».
    // Контакты с telegram_chat_id — основа; остальные ID из DM добавляем как «orphan лиды».
    type Lead = FunnelContact & {
      from_dms: boolean;
      first_seen: string;
      who_from_dms: string | null;
      last_dm_stage: string | null;
      is_spam: boolean;
      is_test: boolean;
    };
    const leads = new Map<string, Lead>();

    // ── 4a. Сначала контакты с chat_id.
    for (const c of cRows) {
      const cid = c.telegram_chat_id;
      const chatDms = cid ? (byChat.get(cid) ?? []) : [];
      const dmFirstAt = chatDms.length ? chatDms[chatDms.length - 1].created_at : null;
      const last = chatDms[0] ?? null;
      const derived = deriveStageFromDms(chatDms);

      // Стадия: contacts.stage если задана, иначе derived. SPAM перебивает всё.
      let stage: FunnelStage = (c.stage as FunnelStage) ?? derived.stage;
      const is_spam = derived.spam || stage === 'spam';
      const is_test = isTest(c, null);

      const first_seen = (dmFirstAt && c.created_at)
        ? (dmFirstAt < c.created_at ? dmFirstAt : c.created_at)
        : (c.created_at ?? dmFirstAt ?? new Date().toISOString());

      const key = cid ?? `contact:${c.id}`;
      leads.set(key, {
        ...c,
        stage,
        last_text: last?.text ?? null,
        last_at: last?.created_at ?? null,
        from_dms: false,
        first_seen,
        who_from_dms: null,
        last_dm_stage: last?.stage ?? null,
        is_spam,
        is_test,
      });
    }

    // ── 4b. Орфаны: chat_id из DM, по которому НЕТ контакта.
    const contactChatIds = new Set(cRows.map((c) => c.telegram_chat_id).filter(Boolean) as string[]);
    for (const [chatId, chatDms] of byChat.entries()) {
      if (contactChatIds.has(chatId)) continue;
      if (leads.has(chatId)) continue;
      const last = chatDms[0];
      const first = chatDms[chatDms.length - 1];
      const derived = deriveStageFromDms(chatDms);
      const who = last?.who ?? last?.username ?? null;
      const is_test = /\btest\b|^тест/i.test((who ?? '').toLowerCase());
      leads.set(chatId, {
        id: `dm:${chatId}`,                       // синтетический id (нет contact-id)
        full_name: who,
        telegram_chat_id: chatId,
        stage: derived.stage,
        segment: null, city: null, has_car: null,
        next_touch_at: null, touch_count: chatDms.length,
        last_direction: last?.direction ?? null,
        objections: null, promises: null, ready_date: null,
        lost_reason: null, do_not_contact: null,
        source: chatId.startsWith('vk:') || chatId.startsWith('vku:') ? 'vk' : 'tg',
        source_code: null, entry_segment: null, human_locked: null,
        created_at: first?.created_at ?? new Date().toISOString(),
        last_text: last?.text ?? null,
        last_at: last?.created_at ?? null,
        from_dms: true,
        first_seen: first?.created_at ?? new Date().toISOString(),
        who_from_dms: who,
        last_dm_stage: last?.stage ?? null,
        is_spam: derived.spam,
        is_test,
      });
    }

    // 5. Фильтр по периоду (по first_seen) + по spam/test.
    const allLeads = [...leads.values()];
    const inPeriod = (l: Lead) => {
      const t = new Date(l.first_seen).getTime();
      if (period.from && t < period.from.getTime()) return false;
      if (period.to && t > period.to.getTime()) return false;
      return true;
    };
    const periodLeads = allLeads.filter(inPeriod);
    const realLeads = periodLeads.filter((l) => !l.is_spam && !l.is_test);
    const spamLeads = includeSpam ? periodLeads.filter((l) => l.is_spam || l.is_test) : [];

    // 6. Сводка по стадиям (без спама/тестов).
    const summary: Record<string, number> = {};
    for (const l of realLeads) {
      const s = (l.stage as string) || 'new';
      summary[s] = (summary[s] ?? 0) + 1;
    }

    // 7. Красная панель — по реальным лидам с активными стадиями (использует поля контакта).
    const nowMs = Date.now();
    const H4 = 4 * 3600_000, H24 = 24 * 3600_000;
    const missing_next_touch: string[] = [];
    const agreed_over_4h: string[] = [];
    const promise_overdue: string[] = [];
    const new_no_reply: string[] = [];
    for (const c of realLeads) {
      if (isActiveStage(c.stage as string) && !c.next_touch_at && !c.from_dms) {
        missing_next_touch.push(c.id);
      }
      if (c.stage === 'agreed') {
        const t = c.last_at ?? c.created_at;
        if (t && nowMs - new Date(t).getTime() > H4) agreed_over_4h.push(c.id);
      }
      const promises = Array.isArray(c.promises) ? c.promises : [];
      for (const p of promises) {
        const status = String((p as Record<string, unknown>).status ?? '');
        const when = (p as Record<string, unknown>).at ?? (p as Record<string, unknown>).created_at;
        if (status !== 'done' && typeof when === 'string') {
          if (nowMs - new Date(when).getTime() > H24) { promise_overdue.push(c.id); break; }
        }
      }
      if (c.stage === 'new' && c.last_direction !== 'out' && c.last_at == null) {
        new_no_reply.push(c.id);
      }
    }

    return NextResponse.json({
      contacts: realLeads,
      spam: spamLeads,
      red: { missing_next_touch, agreed_over_4h, promise_overdue, new_no_reply },
      summary,
      period: {
        key: period.key,
        from: period.from?.toISOString() ?? null,
        to: period.to?.toISOString() ?? null,
      },
      total: realLeads.length,
      total_all: allLeads.length,
      total_spam: allLeads.filter((l) => l.is_spam || l.is_test).length,
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
    // ТЗ-077: лиды из dialog_messages имеют синтетический id `dm:<chat_id>` — PATCH по ним нельзя
    // (нет contact-строки в БД). Сначала надо создать контакт. Тут просто возвращаем 400.
    if (id.startsWith('dm:')) {
      return NextResponse.json({
        error: 'Лид только в диалогах — нет contact-записи. Создай контакт (POST /api/recruit/contacts), потом меняй стадию.',
      }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'id') continue;
      if (ALLOWED.has(k)) patch[k] = v;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
    }

    const supabase = await createClient();
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

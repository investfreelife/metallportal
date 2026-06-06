import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/job-seekers
 *
 * Task 065 (taksopark-machine, sergey-coder): «🔥 Соискатели» — входящий
 * горячий спрос. Парсер (мозг) детектит людей, которые сами пишут «ищу
 * работу» в чатах, и кладёт в channels (type='tracking',
 * config.kind='job_seeker'). Эта вкладка показывает Сергею список,
 * фильтры, кнопку «Написать мягко» (опенер для копирования).
 *
 * Query:
 *   ?status=new|contacted|replied|in_bot|joined|rejected
 *   ?hot=yes — только extra_hot=true
 *   ?q=<поиск по username/name/text>
 *   ?page=1+, ?per=10-200 (default 50)
 *
 * Возвращает: { items, summary: {total, hot, new, contacted, in_bot, joined}, pageInfo }
 */
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  name: string | null;
  status: string | null;
  last_sync_at: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const hot = sp.get('hot') === 'yes';
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const per = Math.max(10, Math.min(200, parseInt(sp.get('per') ?? '50', 10) || 50));

    const supabase = await createClient();
    // У парсера не миллионы строк (соискатели — десятки/сотни в день).
    // Читаем чанками как parser-channels.
    const rows: Row[] = [];
    const CHUNK = 1000;
    const MAX = 5000;
    for (let offset = 0; offset < MAX; offset += CHUNK) {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, status, last_sync_at, config, created_at')
        .eq('tenant_id', tenantId)
        .eq('type', 'tracking')
        .order('created_at', { ascending: false })
        .range(offset, offset + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as Row[];
      const filtered = batch.filter((r) => {
        const c = r.config as { kind?: string } | null;
        return c && c.kind === 'job_seeker';
      });
      rows.push(...filtered);
      if (batch.length < CHUNK) break;
    }

    // Сводка ДО фильтров — для бейджей и фильтр-кнопок.
    const summary = { total: rows.length, hot: 0, new: 0, contacted: 0, in_bot: 0, joined: 0 } as Record<string, number>;
    for (const r of rows) {
      const c = (r.config ?? {}) as Record<string, unknown>;
      if (c.extra_hot === true) summary.hot++;
      const s = String(c.human_status ?? 'new');
      if (s in summary) summary[s] = (summary[s] ?? 0) + 1;
    }

    // Применяем фильтры.
    let items = rows;
    if (hot) items = items.filter((r) => (r.config as { extra_hot?: boolean })?.extra_hot === true);
    if (status) items = items.filter((r) => String((r.config as { human_status?: string })?.human_status ?? 'new') === status);
    if (q) {
      items = items.filter((r) => {
        const c = (r.config ?? {}) as Record<string, unknown>;
        const u = String(c.username ?? '').toLowerCase();
        const n = String(c.name ?? '').toLowerCase();
        const t = String(c.text ?? '').toLowerCase();
        const orig = String(c.original ?? '').toLowerCase();
        return u.includes(q) || n.includes(q) || t.includes(q) || orig.includes(q);
      });
    }

    // Сортировка: hot сперва, потом по свежести (msg_ts → created_at).
    items.sort((a, b) => {
      const ah = (a.config as { extra_hot?: boolean })?.extra_hot === true ? 1 : 0;
      const bh = (b.config as { extra_hot?: boolean })?.extra_hot === true ? 1 : 0;
      if (ah !== bh) return bh - ah;
      const at = (a.config as { msg_ts?: number })?.msg_ts ?? 0;
      const bt = (b.config as { msg_ts?: number })?.msg_ts ?? 0;
      if (at !== bt) return bt - at;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const start = (page - 1) * per;
    const paged = items.slice(start, start + per);

    return NextResponse.json({
      items: paged,
      summary,
      pageInfo: { page, per, pages, total },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/recruit/job-seekers
 *
 * Task 065+ручное добавление: Сергей может вручную завести соискателя
 * (например, увидел в чате не через парсер). Тело — те же поля что у
 * парсера (см. config-таблицу в ТЗ-065). Минимум — username или name.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));

    const cleanStr = (v: unknown, max = 1000): string | null => {
      if (typeof v !== 'string') return null;
      const s = v.trim();
      return s ? s.slice(0, max) : null;
    };

    const username = cleanStr(body.username, 200);
    const name = cleanStr(body.name, 200);
    if (!username && !name) {
      return NextResponse.json({ error: 'Минимум: username или имя' }, { status: 400 });
    }

    const config: Record<string, unknown> = {
      kind: 'job_seeker',
      username: username ? username.replace(/^@/, '') : null,
      name,
      link: username ? `https://t.me/${username.replace(/^@/, '')}` : (cleanStr(body.link, 500) ?? null),
      text: cleanStr(body.text, 2000),
      original: cleanStr(body.original, 4000),
      from_group: cleanStr(body.from_group, 200),
      from_group_name: cleanStr(body.from_group_name, 200),
      city: cleanStr(body.city, 100),
      msg_ts: typeof body.msg_ts === 'number' ? body.msg_ts : Math.floor(Date.now() / 1000),
      extra_hot: !!body.extra_hot,
      contacted: !!body.contacted,
      human_status: typeof body.human_status === 'string' ? body.human_status : 'new',
      note: cleanStr(body.note, 2000),
      labels: Array.isArray(body.labels)
        ? body.labels.map((s: unknown) => String(s).slice(0, 80)).slice(0, 50)
        : [],
      manual: true, // пометка «руками Сергея, не парсером»
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('channels')
      .insert({
        tenant_id: tenantId,
        type: 'tracking',
        name: `seeker:${username ?? name}`,
        config,
      })
      .select('id, config, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

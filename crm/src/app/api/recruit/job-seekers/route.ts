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

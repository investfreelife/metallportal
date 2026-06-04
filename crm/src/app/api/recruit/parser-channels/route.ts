import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/parser-channels
 *
 * Список спарсенных Telegram-групп/каналов tenant'а — для таблицы
 * на /channels (taxi industry). Возвращает страницу + сводку.
 *
 * Query:
 *   q       — поиск по name / config.username / config.found_query
 *   size    — small (<1000) | mid | large (>10000)
 *   joined  — yes | no
 *   has_members — yes | no
 *   sort    — members | name (default: members)
 *   dir     — asc | desc (default: desc)
 *   page    — 1+ (default 1)
 *   per     — 10..200 (default 50)
 *
 * NB: фильтрация members идёт постфактум в JS — config jsonb,
 * supabase-js не строит индексы на subkeys гарантированно. У Столицы
 * 1818 рядов, это OK; для миллионов — материализованное view.
 */
export const dynamic = 'force-dynamic';

interface ChannelRow {
  id: string;
  name: string | null;
  status: string | null;
  last_sync_at: string | null;
  config: Record<string, unknown> | null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;

    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const size = sp.get('size'); // small|mid|large
    const joinedFilter = sp.get('joined'); // yes|no
    const hasMembers = sp.get('has_members'); // yes|no
    const postFilter = sp.get('post'); // yes (свободно) | no (read-only)
    const sort = sp.get('sort') ?? 'members';
    const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const per = Math.max(10, Math.min(200, parseInt(sp.get('per') ?? '50', 10) || 50));

    const supabase = await createClient();
    // У PostgREST дефолтный потолок max-rows=1000 — обходим через .range().
    // У Столицы ~1818 рядов, чанком по 1000 хватит двух запросов.
    const rows: ChannelRow[] = [];
    const CHUNK = 1000;
    const MAX = 5000;
    for (let offset = 0; offset < MAX; offset += CHUNK) {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, status, last_sync_at, config')
        .eq('tenant_id', tenantId)
        .eq('type', 'telegram_channel')
        .order('id', { ascending: true })
        .range(offset, offset + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as ChannelRow[];
      rows.push(...batch);
      if (batch.length < CHUNK) break; // дочитали до конца
    }

    // Нормализация + фильтрация на сервере
    const normalized = rows
      .filter((r) => {
        // Исключаем системные строки (parser_status / parser_control) — у них kind в config
        const cfg = r.config ?? {};
        return !str(cfg.kind);
      })
      .map((r) => {
        const cfg = (r.config ?? {}) as Record<string, unknown>;
        const username = str(cfg.username);
        const link = str(cfg.link)
          ?? (username ? `https://t.me/${username.replace(/^@/, '')}` : null);
        const members = num(cfg.members);
        const isGroup = cfg.is_group === true || str(cfg.role) === 'donor_group';
        // Реальная разметка парсера: можно ли обычному участнику писать в группу.
        // can_post=true → свободно; false → read-only (через бота/админа); null → не размечено.
        const canPostRaw = bool(cfg.can_post);
        const postVia = str(cfg.post_via);
        const joined = bool(cfg.joined);
        const country = str(cfg.country) ?? null;
        const foundQuery = str(cfg.found_query) ?? null;
        // Город = последнее непустое слово запроса, если его можно угадать
        const city = foundQuery
          ? (foundQuery.trim().split(/\s+/).slice(-1)[0] || null)
          : null;
        return {
          id: r.id,
          name: r.name ?? username ?? 'без названия',
          username: username,
          link,
          members,
          country,
          found_query: foundQuery,
          city,
          is_group: isGroup,
          can_post: canPostRaw,
          post_via: postVia,
          joined,
          source: str(cfg.source) ?? null,
          last_sync_at: r.last_sync_at,
        };
      });

    // Сводка по ВСЕМ строкам тенанта (до фильтров) — это контекст.
    const summary = {
      total: normalized.length,
      small: normalized.filter((r) => r.members != null && r.members < 1000).length,
      mid: normalized.filter((r) => r.members != null && r.members >= 1000 && r.members <= 10000).length,
      large: normalized.filter((r) => r.members != null && r.members > 10000).length,
      no_members: normalized.filter((r) => r.members == null).length,
      joined: normalized.filter((r) => r.joined === true).length,
      postable: normalized.filter((r) => r.can_post === true).length,
      readonly: normalized.filter((r) => r.can_post === false).length,
    };

    // Фильтры
    let filtered = normalized;
    if (q) {
      filtered = filtered.filter((r) =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.username ?? '').toLowerCase().includes(q) ||
        (r.found_query ?? '').toLowerCase().includes(q) ||
        (r.city ?? '').toLowerCase().includes(q)
      );
    }
    if (size === 'small') filtered = filtered.filter((r) => r.members != null && r.members < 1000);
    else if (size === 'mid') filtered = filtered.filter((r) => r.members != null && r.members >= 1000 && r.members <= 10000);
    else if (size === 'large') filtered = filtered.filter((r) => r.members != null && r.members > 10000);
    if (joinedFilter === 'yes') filtered = filtered.filter((r) => r.joined === true);
    else if (joinedFilter === 'no') filtered = filtered.filter((r) => r.joined !== true);
    if (hasMembers === 'yes') filtered = filtered.filter((r) => r.members != null);
    else if (hasMembers === 'no') filtered = filtered.filter((r) => r.members == null);
    if (postFilter === 'yes') filtered = filtered.filter((r) => r.can_post === true);
    else if (postFilter === 'no') filtered = filtered.filter((r) => r.can_post === false);

    // Сортировка
    const sign = dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (sort === 'name') {
        return (a.name ?? '').localeCompare(b.name ?? '', 'ru') * sign;
      }
      // members: null в конец независимо от направления
      const am = a.members;
      const bm = b.members;
      if (am == null && bm == null) return 0;
      if (am == null) return 1;
      if (bm == null) return -1;
      return (am - bm) * sign;
    });

    const totalFiltered = filtered.length;
    const start = (page - 1) * per;
    const items = filtered.slice(start, start + per);

    return NextResponse.json({
      items,
      summary,
      page: {
        page,
        per,
        total: totalFiltered,
        pages: Math.max(1, Math.ceil(totalFiltered / per)),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

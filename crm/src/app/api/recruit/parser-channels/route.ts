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
        // Обогащение со страницы t.me: контакт для ПЛАТНОГО размещения + режим постинга.
        const adContact = str(cfg.ad_contact);   // @бот/@админ для платного поста
        const postMode = str(cfg.post_mode);      // free | bot_paid | readonly
        const about = str(cfg.about);
        const joined = bool(cfg.joined);
        // Новые поля парсера: статус наших постов / правила / условие подписки.
        const postRejected = bool(cfg.post_rejected); // наши посты удаляют/забанили → не постим
        const rules = str(cfg.rules);                 // правила/описание группы
        const requiredChannel = str(cfg.required_channel); // username без @, нужна подписка
        // Профиль проверки группы (новые поля парсера).
        const publishOk = bool(cfg.publish_ok);       // проверена: Россия + легально + без угроз
        const legal = str(cfg.legal);                 // «чисто» или описание противозаконного
        const threatsSeen = str(cfg.threats_seen);    // найденные угрозы или «нет»
        // Поля статуса/категоризации группы (новый пайплайн парсера).
        const status = str(cfg.status);               // стадия пайплайна
        const needsHuman = bool(cfg.needs_human);     // нужен взгляд человека
        const joinType = str(cfg.join_type);          // как вступать
        const audience = str(cfg.audience);           // целевая аудитория
        const workStatus = str(cfg.work_status);      // работаем ли мы с этой группой сейчас
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
          status,
          needs_human: needsHuman,
          join_type: joinType,
          audience,
          work_status: workStatus,
          can_post: canPostRaw,
          post_via: postVia,
          ad_contact: adContact,
          ad_link: adContact ? `https://t.me/${adContact.replace(/^@/, '')}` : null,
          post_mode: postMode,
          about,
          joined,
          post_rejected: postRejected,
          publish_ok: publishOk,
          legal,
          threats_seen: threatsSeen,
          rules,
          required_channel: requiredChannel,
          required_link: requiredChannel ? `https://t.me/${requiredChannel.replace(/^@/, '')}` : null,
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
      bot_paid: normalized.filter((r) => !!r.ad_contact).length,
      rejected: normalized.filter((r) => r.post_rejected === true).length,
      verified: normalized.filter((r) => r.publish_ok === true).length,
      needs_human: normalized.filter((r) => r.needs_human === true).length,
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
    else if (postFilter === 'paid') filtered = filtered.filter((r) => !!r.ad_contact);
    else if (postFilter === 'rejected') filtered = filtered.filter((r) => r.post_rejected === true);
    else if (postFilter === 'verified') filtered = filtered.filter((r) => r.publish_ok === true);
    const statusFilter = sp.get('status');
    if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
    if (sp.get('needs_human') === '1') filtered = filtered.filter((r) => r.needs_human === true);

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

/**
 * POST /api/recruit/parser-channels
 *
 * Sergey directive 2026-06-06: «дай добавлять каналы вручную». Принимает
 * базовые поля + любые config-поля из whitelist'а (см. PATCH). type
 * фиксируется = 'telegram_channel' (системные parser_* сюда не пускаем).
 */
const CONFIG_FIELDS_FOR_INSERT = new Set([
  'username', 'link', 'members', 'about', 'city', 'country', 'audience',
  'is_group', 'role', 'can_post', 'post_via', 'post_mode', 'ad_contact',
  'joined', 'rules', 'required_channel',
  'publish_ok', 'legal', 'threats_seen',
  'status', 'needs_human', 'join_type', 'work_status',
  'found_query',
]);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 500) : '';
    if (!name) return NextResponse.json({ error: 'name обязателен' }, { status: 400 });
    const status = typeof body.status === 'string' ? body.status.slice(0, 50) : null;

    const config: Record<string, unknown> = { manual: true };
    for (const [k, v] of Object.entries(body.config ?? {})) {
      if (CONFIG_FIELDS_FOR_INSERT.has(k)) config[k] = v;
    }
    // Авто-link если задан username.
    if (!config.link && typeof config.username === 'string' && config.username) {
      config.link = `https://t.me/${String(config.username).replace(/^@/, '')}`;
    }

    const supabase = await createClient();
    const insertBody: Record<string, unknown> = {
      tenant_id: tenantId,
      type: 'telegram_channel',
      name,
      config,
    };
    if (status) insertBody.status = status;

    const { data, error } = await supabase
      .from('channels').insert(insertBody)
      .select('id, name, type, status, config, last_sync_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

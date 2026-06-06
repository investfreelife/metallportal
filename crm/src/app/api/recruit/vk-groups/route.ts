import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET/POST /api/recruit/vk-groups
 *
 * Источник: `channels` где `config.kind='vk_group'` (см. ТЗ-070, парсер
 * `automation/parser/vk_groups_parser.py`). Sergey directive 2026-06-06:
 * «сделай как в Telegram — добавлять/редактировать, описание, фильтр
 * можно-писать/платно».
 *
 * Query (GET):
 *   q          — поиск по name / screen_name / city / found_query
 *   mode       — post_mode фильтр (open|suggest|comments|ads|closed|paid|own)
 *   post       — yes (можно писать: own/open/suggest/comments) | paid (paid/ads/ad_contact)
 *   page, per  — пагинация
 */
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  name: string | null;
  status: string | null;
  created_at: string;
  config: Record<string, unknown> | null;
}

function str(v: unknown): string | null { return typeof v === 'string' ? v : null; }
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}
function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') { if (v === 'true') return true; if (v === 'false') return false; }
  return null;
}

const POST_MODES = new Set(['own', 'open', 'suggest', 'comments', 'paid', 'ads', 'closed']);
/** «можно писать» — те modes, где наша команда реально может донести пост сама. */
const CAN_WRITE = new Set(['own', 'open', 'suggest', 'comments']);
/** «платно» — через VK Ads, прямую оплату админу. */
const PAID_MODES = new Set(['paid', 'ads']);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;

    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const mode = sp.get('mode'); // open|suggest|comments|ads|closed|paid|own
    const post = sp.get('post'); // yes (можно писать) | paid
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
    const per = Math.max(10, Math.min(200, parseInt(sp.get('per') ?? '50', 10) || 50));

    const supabase = await createClient();
    const rows: Row[] = [];
    const CHUNK = 1000;
    const MAX = 10000;
    for (let offset = 0; offset < MAX; offset += CHUNK) {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, status, created_at, config')
        .eq('tenant_id', tenantId)
        .filter('config->>kind', 'eq', 'vk_group')
        .order('created_at', { ascending: false })
        .range(offset, offset + CHUNK - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data ?? []) as Row[];
      rows.push(...batch);
      if (batch.length < CHUNK) break;
    }

    const items = rows.map((r) => {
      const c = (r.config ?? {}) as Record<string, unknown>;
      const screen = str(c.screen_name);
      const link = str(c.link) ?? (screen ? `https://vk.com/${screen}` : null);
      const adContact = str(c.ad_contact);
      const postMode = str(c.post_mode);
      return {
        id: r.id,
        name: str(r.name) ?? str(c.name) ?? screen ?? '—',
        status: r.status,
        screen_name: screen,
        vk_id: num(c.vk_id),
        link,
        members: num(c.members),
        is_closed: bool(c.is_closed),
        can_post: bool(c.can_post),
        post_mode: postMode,
        ad_contact: adContact,
        ad_link: adContact ? (adContact.startsWith('http') ? adContact : `https://vk.com/${adContact.replace(/^@/, '')}`) : null,
        city: str(c.city),
        found_query: str(c.found_query),
        manual_desc: str(c.manual_desc),
        manual_mechanics: str(c.manual_mechanics),
        seed_ready: bool(c.seed_ready),
        human_status: str(c.human_status),
        human_verified: bool(c.human_verified),
        source: str(c.source) ?? null,
        manual: c.manual === true || c.source === 'manual',
        created_at: r.created_at,
      };
    });

    const summary = {
      total: items.length,
      can_write: items.filter((g) => g.post_mode && CAN_WRITE.has(g.post_mode)).length,
      paid: items.filter((g) => (g.post_mode && PAID_MODES.has(g.post_mode)) || !!g.ad_contact).length,
      open: items.filter((g) => g.post_mode === 'open').length,
      suggest: items.filter((g) => g.post_mode === 'suggest').length,
      comments: items.filter((g) => g.post_mode === 'comments').length,
      ads: items.filter((g) => g.post_mode === 'ads').length,
      closed: items.filter((g) => g.post_mode === 'closed').length,
      seed_ready: items.filter((g) => g.seed_ready === true).length,
    };

    let filtered = items;
    if (q) {
      filtered = filtered.filter((g) =>
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.screen_name ?? '').toLowerCase().includes(q) ||
        (g.city ?? '').toLowerCase().includes(q) ||
        (g.found_query ?? '').toLowerCase().includes(q)
      );
    }
    if (mode) filtered = filtered.filter((g) => g.post_mode === mode);
    if (post === 'yes') filtered = filtered.filter((g) => g.post_mode && CAN_WRITE.has(g.post_mode));
    else if (post === 'paid') filtered = filtered.filter((g) => (g.post_mode && PAID_MODES.has(g.post_mode)) || !!g.ad_contact);

    const total = filtered.length;
    const start = (page - 1) * per;
    const slice = filtered.slice(start, start + per);

    return NextResponse.json({
      items: slice,
      summary,
      page: { page, per, total, pages: Math.max(1, Math.ceil(total / per)) },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const SCREEN_RE = /(?:vk\.com\/|@)?([A-Za-z][A-Za-z0-9_\.]{2,31})/g;

/** Парсер vk.com-ссылок и screen_name'ов. Лояльный. */
function extractScreens(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [input];
  const out = new Set<string>();
  for (const it of arr) {
    if (typeof it !== 'string') continue;
    let m: RegExpExecArray | null;
    SCREEN_RE.lastIndex = 0;
    while ((m = SCREEN_RE.exec(it)) !== null) {
      const s = m[1].toLowerCase();
      if (/^(http|https|com|org|club|public|away|feed|im)$/.test(s)) continue;
      out.add(s);
    }
  }
  return [...out];
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));
    const supabase = await createClient();

    // ----- batch-режим: {screens|screens_text|usernames|usernames_text|links} -----
    if (Array.isArray(body.screens) || typeof body.screens_text === 'string' ||
        Array.isArray(body.usernames) || typeof body.usernames_text === 'string' ||
        typeof body.links === 'string' || Array.isArray(body.links)) {
      const input = body.screens ?? body.screens_text ?? body.usernames ?? body.usernames_text ?? body.links;
      const candidates = extractScreens(input);
      if (!candidates.length) {
        return NextResponse.json({ error: 'Не нашёл ни одной VK-ссылки/screen_name в вводе' }, { status: 400 });
      }
      // дедуп по уже существующим (config.screen_name).
      const existing = new Set<string>();
      const CHUNK = 1000;
      for (let offset = 0; offset < 10000; offset += CHUNK) {
        const { data, error } = await supabase
          .from('channels')
          .select('config')
          .eq('tenant_id', tenantId)
          .filter('config->>kind', 'eq', 'vk_group')
          .range(offset, offset + CHUNK - 1);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const batch = data ?? [];
        for (const r of batch) {
          const s = (r.config as { screen_name?: unknown } | null)?.screen_name;
          if (typeof s === 'string') existing.add(s.toLowerCase());
        }
        if (batch.length < CHUNK) break;
      }
      const fresh = candidates.filter((s) => !existing.has(s));
      const skipped = candidates.filter((s) => existing.has(s));

      const now = new Date().toISOString();
      const rows = fresh.map((s) => ({
        tenant_id: tenantId,
        type: 'tracking',
        name: s,
        status: 'inactive',
        config: {
          kind: 'vk_group',
          source: 'manual',
          screen_name: s,
          link: `https://vk.com/${s}`,
          manual: true,
          human_joined: true,
          seed_ready: false,
          human_locked: true,
          human_locked_at: now,
        },
      }));

      const added: Array<{ id: string; screen_name: string }> = [];
      if (rows.length) {
        const { data, error } = await supabase
          .from('channels').insert(rows)
          .select('id, config');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        for (const r of data ?? []) {
          const s = (r.config as { screen_name?: unknown } | null)?.screen_name;
          if (typeof s === 'string') added.push({ id: r.id, screen_name: s });
        }
      }
      return NextResponse.json({ added, skipped, requested: candidates.length });
    }

    // ----- одиночное создание из формы (name, screen_name, members, post_mode, …) -----
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 500) : '';
    const screen = typeof body.screen_name === 'string' ? body.screen_name.trim().replace(/^@/, '').toLowerCase().slice(0, 100) : '';
    if (!screen && !name) return NextResponse.json({ error: 'name или screen_name обязателен' }, { status: 400 });

    const now = new Date().toISOString();
    const config: Record<string, unknown> = {
      kind: 'vk_group',
      source: 'manual',
      manual: true,
      human_locked: true,
      human_locked_at: now,
      seed_ready: false,
    };
    if (screen) {
      config.screen_name = screen;
      config.link = `https://vk.com/${screen}`;
    }
    const incoming = (body.config ?? {}) as Record<string, unknown>;
    if (typeof incoming.members !== 'undefined') config.members = num(incoming.members);
    if (typeof incoming.city === 'string') config.city = incoming.city.trim();
    if (typeof incoming.post_mode === 'string' && POST_MODES.has(incoming.post_mode)) config.post_mode = incoming.post_mode;
    if (typeof incoming.ad_contact === 'string') config.ad_contact = incoming.ad_contact.trim();
    if (typeof incoming.manual_desc === 'string') config.manual_desc = incoming.manual_desc.trim().slice(0, 2000);
    if (typeof incoming.manual_mechanics === 'string') config.manual_mechanics = incoming.manual_mechanics.trim().slice(0, 2000);
    if (typeof incoming.found_query === 'string') config.found_query = incoming.found_query.trim();
    if (incoming.is_closed === true || incoming.is_closed === false) config.is_closed = incoming.is_closed;

    const insertBody = {
      tenant_id: tenantId,
      type: 'tracking',
      name: name || screen,
      status: 'inactive',
      config,
    };
    const { data, error } = await supabase
      .from('channels').insert(insertBody)
      .select('id, name, config, status, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

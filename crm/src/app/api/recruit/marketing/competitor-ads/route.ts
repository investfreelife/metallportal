import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/marketing/competitor-ads
 *
 * Галерея реальных объявлений конкурентов tenant'а (competitor_ads).
 * Заполняется скрейпером VK + сайты + Telegram + Яндекс.
 *
 * Query:
 *   ?channel=vk|site|telegram|yandex  — фильтр канала (опц.)
 *   ?brand=<точное имя>               — фильтр бренда (опц.)
 *   ?q=<поиск>                        — ilike по text/hooks/brand
 *
 * Возвращает:
 *   {items, totals: {total, by_channel, by_brand}, brands: string[]}
 *
 * POST /api/recruit/marketing/competitor-ads
 *   Body: {channel, brand, text, source_link, image_url?, hooks?, reach?}
 *   Sergey directive 2026-06-04: ручное добавление интересных конкурентов.
 *   Скрейпер заполнит автоматом основной поток, эта форма — для редкого «глянул, сохрани».
 */
export const dynamic = 'force-dynamic';

const ALLOWED_CHANNELS = new Set(['vk', 'site', 'telegram', 'yandex']);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const body = await req.json().catch(() => ({}));
    const channel = String(body.channel ?? '').trim().toLowerCase();
    const brand = String(body.brand ?? '').trim();
    const text = String(body.text ?? '').trim();
    const source_link = String(body.source_link ?? '').trim();
    const image_url = String(body.image_url ?? '').trim();
    const hooks = String(body.hooks ?? '').trim();
    const reachRaw = body.reach;
    const reach = reachRaw === null || reachRaw === undefined || reachRaw === ''
      ? null
      : Number(reachRaw);

    if (channel && !ALLOWED_CHANNELS.has(channel)) {
      return NextResponse.json({ error: `channel должен быть одним из: ${[...ALLOWED_CHANNELS].join(', ')}` }, { status: 400 });
    }
    if (!source_link && !text) {
      return NextResponse.json({ error: 'Нужна ссылка или текст' }, { status: 400 });
    }
    if (reach !== null && (!Number.isFinite(reach) || reach < 0)) {
      return NextResponse.json({ error: 'reach должен быть числом ≥ 0' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('competitor_ads')
      .insert({
        tenant_id: tenantId,
        channel: channel || null,
        brand: brand || null,
        text: text || null,
        source_link: source_link || null,
        image_url: image_url || null,
        hooks: hooks || null,
        reach,
      })
      .select('id, channel, brand, text, image_url, source_link, hooks, reach, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ad: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface AdRow {
  id: string;
  channel: string | null;
  brand: string | null;
  text: string | null;
  image_url: string | null;
  source_link: string | null;
  hooks: string | null;
  reach: number | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const sp = req.nextUrl.searchParams;
    const channel = sp.get('channel');
    const brand = sp.get('brand');
    const q = (sp.get('q') ?? '').trim();

    const supabase = await createClient();
    // ЛЁГКАЯ выборка ВСЕХ строк tenant'а: у Столицы 122, спокойно.
    // Для масштаба позже — pagination.
    const { data, error } = await supabase
      .from('competitor_ads')
      .select('id, channel, brand, text, image_url, source_link, hooks, reach, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let items = (data ?? []) as AdRow[];

    // Сводка по всем рядам (без фильтров) — для счётчиков в UI.
    const byChannel: Record<string, number> = {};
    const byBrand: Record<string, number> = {};
    for (const r of items) {
      const ch = (r.channel ?? '').toLowerCase() || '—';
      byChannel[ch] = (byChannel[ch] ?? 0) + 1;
      const br = r.brand ?? '—';
      byBrand[br] = (byBrand[br] ?? 0) + 1;
    }
    const brands = Object.keys(byBrand).sort();

    // Фильтры применяем post-fetch.
    if (channel) items = items.filter((r) => (r.channel ?? '').toLowerCase() === channel.toLowerCase());
    if (brand) items = items.filter((r) => (r.brand ?? '') === brand);
    if (q) {
      const lc = q.toLowerCase();
      items = items.filter((r) =>
        (r.text ?? '').toLowerCase().includes(lc) ||
        (r.hooks ?? '').toLowerCase().includes(lc) ||
        (r.brand ?? '').toLowerCase().includes(lc)
      );
    }

    return NextResponse.json({
      items,
      totals: { total: (data ?? []).length, by_channel: byChannel, by_brand: byBrand },
      brands,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

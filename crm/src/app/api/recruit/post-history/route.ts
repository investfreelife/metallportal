import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/post-history — история ВСЕХ публикаций (посевов).
 *
 * Источник правды: `channels` где `config.kind='source_codes'`. Каждая строка =
 * одна публикация, которую сделал постер (CRM own-каналы ИЛИ Python-посев в чужие
 * VK-группы). Сюда же чеканится код атрибуции. Поля config:
 *   code, channel, placement(где), post_ref(какой пост), segment, placed_at(когда), post_url.
 * Лиды джойнятся по contacts.source_code = code.
 */
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  created_at: string;
  config: Record<string, unknown> | null;
}
function str(v: unknown): string | null { return typeof v === 'string' ? v : null; }

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('channels')
      .select('id, created_at, config')
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .filter('config->>kind', 'eq', 'source_codes')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Row[];
    const codes = rows
      .map((r) => str(r.config?.code))
      .filter((c): c is string => !!c);

    // Сколько лидов пришло по каждому коду (contacts.source_code = code).
    const leadsByCode: Record<string, number> = {};
    if (codes.length) {
      const { data: leads } = await supabase
        .from('contacts')
        .select('source_code')
        .eq('tenant_id', tenantId)
        .in('source_code', codes);
      for (const l of (leads ?? []) as { source_code: string | null }[]) {
        if (l.source_code) leadsByCode[l.source_code] = (leadsByCode[l.source_code] ?? 0) + 1;
      }
    }

    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v
      : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

    const items = rows.map((r) => {
      const c = r.config ?? {};
      const code = str(c.code);
      const audience = num(c.audience);
      const leads = code ? (leadsByCode[code] ?? 0) : 0;
      const st = (c.stats && typeof c.stats === 'object') ? c.stats as Record<string, unknown> : {};
      return {
        id: r.id,
        code,
        channel: str(c.channel),
        placement: str(c.placement),
        post_ref: str(c.post_ref),
        segment: str(c.segment),
        placed_at: str(c.placed_at) ?? r.created_at,
        post_url: str(c.post_url),
        bot_link: code ? `https://t.me/${process.env.BOT_USERNAME || 'stolica_dostavka_bot'}?start=${code}` : null,
        audience,                                            // охват = members группы
        leads,
        // конверсия охват→лид, %
        cr: audience && audience > 0 ? Math.round((leads / audience) * 100000) / 1000 : null,
        views: num(st.views),
        comments: num(st.comments),
        likes: num(st.likes),
        reposts: num(st.reposts),
        above: num(st.above),                                // сколько постов сверху (утонул)
        stats_at: str(st.checked_at),
        hour_msk: (() => { const d = new Date(str(c.placed_at) ?? r.created_at); return Number.isNaN(d.getTime()) ? null : (d.getUTCHours() + 3) % 24; })(),
      };
    });

    // ── Прайм-тайм: агрегат по часу публикации (МСК) ──────────────────
    const byHourMap: Record<number, { posts: number; leads: number; audience: number; views: number }> = {};
    for (const i of items) {
      if (i.hour_msk == null) continue;
      const h = i.hour_msk;
      byHourMap[h] = byHourMap[h] || { posts: 0, leads: 0, audience: 0, views: 0 };
      byHourMap[h].posts++; byHourMap[h].leads += i.leads;
      byHourMap[h].audience += i.audience ?? 0; byHourMap[h].views += i.views ?? 0;
    }
    const byHour = Object.entries(byHourMap).map(([h, v]) => ({
      hour: Number(h), ...v,
      cr: v.audience > 0 ? Math.round((v.leads / v.audience) * 100000) / 1000 : null,
    })).sort((a, b) => a.hour - b.hour);

    return NextResponse.json({
      items,
      total: items.length,
      total_leads: items.reduce((s, i) => s + i.leads, 0),
      total_audience: items.reduce((s, i) => s + (i.audience ?? 0), 0),
      byHour,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

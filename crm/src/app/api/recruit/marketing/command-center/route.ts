import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/marketing/command-center
 *
 * ТЗ-073: «Командный центр» вкладки Стратегия. Только РЕАЛЬНЫЕ данные из
 * реестра source_codes + воронки CRM, БЕЗ выдуманных чисел.
 *
 * Возвращает:
 *   funnel       = {reach, leads, hires, cr_lead, cr_hire}
 *   north_star   = {target=30, deadline=2026-07-31, current=hires, days_left}
 *   forecast     = {sensitivity[{cr_lead, audience_for_30}], measured_cr_lead, honest_note}
 *   plan_fact    = массив 25 каналов (KB-18 §B) с фактом охвата/лидов
 *   best         = {variant, hour, channel} — по CR (если данные есть)
 *
 * Источник KB-18 (knowledge-base): план каналов + мат-модель воронки.
 */
export const dynamic = 'force-dynamic';

/** План каналов из KB-18 §B (25 шт.). status="запущен"/"в очереди"/"не начат" будет
 *  пересчитан фактически по реестру (есть посты с этим channel → запущен).
 *  planned_audience — ориентировочный потенциал канала (для контекста, см. KB-18 §B). */
const CHANNELS_PLAN: Array<{ key: string; name: string; tier: 1 | 2 | 3; planned_audience: number; aliases?: string[] }> = [
  // Тир-1
  { key: 'avito',      name: 'Avito Работа',          tier: 1, planned_audience: 20_000_000 },
  { key: 'trudvsem',   name: 'Трудвсем (госпортал)',  tier: 1, planned_audience: 5_000_000 },
  { key: 'telegram',   name: 'Telegram каналы/чаты',  tier: 1, planned_audience: 10_000_000, aliases: ['tg'] },
  { key: 'vk',         name: 'VK группы (дрип)',      tier: 1, planned_audience: 28_000_000 },
  { key: 'ok',         name: 'Одноклассники',         tier: 1, planned_audience: 8_000_000 },
  // Тир-2
  { key: 'youla',      name: 'Юла',                   tier: 2, planned_audience: 5_000_000 },
  { key: 'aggregators',name: 'ГородРабот / Зарплата.ру / Работа.ру', tier: 2, planned_audience: 3_000_000 },
  { key: 'dzen',       name: 'Яндекс Дзен',           tier: 2, planned_audience: 4_000_000 },
  { key: 'yandex_uslugi', name: 'Яндекс Услуги',      tier: 2, planned_audience: 2_000_000 },
  { key: 'vk_video',   name: 'VK Видео / VK Клипы',   tier: 2, planned_audience: 5_000_000 },
  { key: 'shorts',     name: 'YouTube Shorts',        tier: 2, planned_audience: 4_000_000 },
  { key: 'rutube',     name: 'Rutube / Yappy',        tier: 2, planned_audience: 1_000_000 },
  { key: '2gis',       name: '2GIS / Яндекс Карты',   tier: 2, planned_audience: 500_000 },
  // Тир-3
  { key: 'tiktok',     name: 'TikTok (ЕАЭС-аккаунты)', tier: 3, planned_audience: 3_000_000 },
  { key: 'instagram',  name: 'Instagram Reels',       tier: 3, planned_audience: 2_000_000 },
  { key: 'likee',      name: 'Likee',                 tier: 3, planned_audience: 500_000 },
  { key: 'whatsapp',   name: 'WhatsApp/Viber диаспоры', tier: 3, planned_audience: 500_000 },
  { key: 'pikabu',     name: 'Пикабу',                tier: 3, planned_audience: 1_000_000 },
  { key: 'forums',     name: 'Форумы водителей (drom и т.п.)', tier: 3, planned_audience: 300_000 },
  { key: 'tg_catalogs',name: 'TG каталоги/folders',   tier: 3, planned_audience: 500_000 },
  { key: 'boards',     name: 'Объявления-доски',      tier: 3, planned_audience: 500_000 },
  { key: 'reddit',     name: 'Reddit r/russia',       tier: 3, planned_audience: 200_000 },
  { key: 'students',   name: 'Студенческие паблики',  tier: 3, planned_audience: 1_000_000 },
  { key: 'side_hustle',name: 'Сайты подработки',      tier: 3, planned_audience: 500_000 },
  { key: 'referral',   name: 'Реферальная программа', tier: 3, planned_audience: 1_000_000, aliases: ['ref'] },
  // Лендинг отдельно (наш CTA-канал)
  { key: 'landing',    name: 'Лендинги (ld_*)',       tier: 1, planned_audience: 0, aliases: ['ld_moskva','ld_priezzhim','ld_podrabotka','ld_dostavka','ld_edet'] },
];

const NORTH_STAR_TARGET = 30;
const NORTH_STAR_DEADLINE = '2026-07-31';
/** Стадии воронки, считающиеся «найм» (вышел на линию + удержание). */
const HIRED_STAGES = new Set(['online', 'retained']);

function str(v: unknown): string | null { return typeof v === 'string' ? v : null; }
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

interface SourceRow { id: string; config: Record<string, unknown> | null; created_at: string; }
interface ContactRow { id: string; stage: string | null; source_code: string | null; source: string | null; }

/** ТЗ-078: маппинг `contacts.source` → канал (по префиксу/значению). */
function channelFromSource(src: string | null): string | null {
  if (!src) return null;
  const s = src.toLowerCase();
  if (s.startsWith('vk:') || s === 'vk' || s.startsWith('vk_')) return 'vk';
  if (s.startsWith('tg:') || s.startsWith('telegram:') || s === 'tg' || s === 'telegram') return 'telegram';
  if (s.startsWith('ld_') || s === 'landing' || s.startsWith('landing')) return 'landing';
  if (s.startsWith('avito')) return 'avito';
  if (s.startsWith('ok:') || s === 'ok') return 'ok';
  if (s.startsWith('tiktok')) return 'tiktok';
  if (s.startsWith('ig:') || s.startsWith('instagram')) return 'instagram';
  return null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    // 1. Реестр source_codes — все публикации.
    const { data: srcData, error: srcErr } = await supabase
      .from('channels')
      .select('id, created_at, config')
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .filter('config->>kind', 'eq', 'source_codes')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });
    const srcRows = (srcData ?? []) as SourceRow[];

    // 2. Контакты — для подсчёта найма и лидов по коду.
    const { data: contactsData, error: cErr } = await supabase
      .from('contacts')
      .select('id, stage, source_code, source')
      .eq('tenant_id', tenantId)
      .limit(20000);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    const contactsAll = (contactsData ?? []) as ContactRow[];
    // ТЗ-078: исключаем спам из лидов/курьеров (как в /funnel-stages).
    const contacts = contactsAll.filter((c) => (c.stage ?? '') !== 'spam');

    // 3. Лиды по коду (точная атрибуция) + общая воронка + курьеры по каналу.
    const leadsByCode: Record<string, number> = {};
    for (const c of contacts) {
      if (c.source_code) leadsByCode[c.source_code] = (leadsByCode[c.source_code] ?? 0) + 1;
    }
    // ТЗ-078: лиды и курьеры по КАНАЛУ (по contacts.source префиксу).
    type ChMetric = { leads: number; couriers: number; leads_attributed: number };
    const channelMetrics: Record<string, ChMetric> = {};
    for (const c of contacts) {
      const ch = channelFromSource(c.source);
      if (!ch) continue;
      channelMetrics[ch] = channelMetrics[ch] || { leads: 0, couriers: 0, leads_attributed: 0 };
      channelMetrics[ch].leads++;
      if (c.source_code) channelMetrics[ch].leads_attributed++;
      if (HIRED_STAGES.has(c.stage ?? '')) channelMetrics[ch].couriers++;
    }
    const hires = contacts.filter((c) => HIRED_STAGES.has(c.stage ?? '')).length;

    // 4. Агрегация по каналу (alias → main key)
    const aliasToKey: Record<string, string> = {};
    for (const ch of CHANNELS_PLAN) {
      aliasToKey[ch.key] = ch.key;
      for (const a of ch.aliases ?? []) aliasToKey[a.toLowerCase()] = ch.key;
    }
    function normaliseChannel(raw: string | null): string {
      if (!raw) return 'other';
      const r = raw.toLowerCase().trim();
      if (aliasToKey[r]) return aliasToKey[r];
      // ld_<seg> → landing
      if (r.startsWith('ld_')) return 'landing';
      return r;
    }

    // ТЗ-074: расширенная агрегация — добавлены views/cost/today для воронки-дашборда.
    type ChAgg = {
      posts: number; audience: number; leads: number;
      views: number; views_seen: boolean;       // views_seen=true если хоть один post отдал views (для honest-empty по органике)
      cost: number;                              // Σ config.cost (бесплатные органические каналы = 0)
      today_posts: number; today_audience: number;
      deleted: number; blocked: number; comments: number;
    };
    const factByChannel: Record<string, ChAgg> = {};
    const todayMidnight = (() => { const d = new Date(); d.setUTCHours(-3,0,0,0); return d.getTime(); })(); // 00:00 МСК
    for (const r of srcRows) {
      const c = r.config ?? {};
      const code = str(c.code);
      const audience = num(c.audience) ?? 0;
      const leads = code ? (leadsByCode[code] ?? 0) : 0;
      const chKey = normaliseChannel(str(c.channel));
      const st = (c.stats && typeof c.stats === 'object') ? c.stats as Record<string, unknown> : {};
      const views = num(st.views);
      const cost = num(c.cost) ?? 0;
      const placedAt = str(c.placed_at) ?? r.created_at;
      const placedMs = new Date(placedAt).getTime();
      const isToday = !Number.isNaN(placedMs) && placedMs >= todayMidnight;
      const stStatus = str(st.status);

      factByChannel[chKey] = factByChannel[chKey] || {
        posts: 0, audience: 0, leads: 0, views: 0, views_seen: false, cost: 0,
        today_posts: 0, today_audience: 0, deleted: 0, blocked: 0, comments: 0,
      };
      const a = factByChannel[chKey];
      a.posts++;
      a.audience += audience;
      a.leads += leads;
      if (views != null) { a.views += views; a.views_seen = true; }
      a.cost += cost;
      if (isToday) { a.today_posts++; a.today_audience += audience; }
      if (stStatus === 'deleted') a.deleted++;
      if (stStatus === 'blocked') a.blocked++;
      a.comments += num(st.comments) ?? 0;
    }

    const totalReach = Object.values(factByChannel).reduce((s, v) => s + v.audience, 0);
    const totalLeads = Object.values(factByChannel).reduce((s, v) => s + v.leads, 0);
    const totalViews = Object.values(factByChannel).reduce((s, v) => s + v.views, 0);
    const totalCost = Object.values(factByChannel).reduce((s, v) => s + v.cost, 0);
    const anyViewsAvailable = Object.values(factByChannel).some((v) => v.views_seen);

    // 5. План/факт по 25 каналам — расширен ТЗ-074 (views/cost/cpl/today) + ТЗ-078 (channel-leads, couriers, cr_to_courier).
    const plan_fact = CHANNELS_PLAN.map((ch) => {
      const f = factByChannel[ch.key];
      const m = channelMetrics[ch.key];                  // ТЗ-078: лиды/курьеры по source
      // Активность канала определяем теперь не только по постам, но и по лидам
      // (Anastasia: vk-лид есть, постов в реестре нет → канал «vk» статусом «запущен»).
      const hasActivity = (f?.posts ?? 0) > 0 || (m?.leads ?? 0) > 0;
      const status = !hasActivity ? 'не начат' : (f && f.posts > 0 ? 'запущен' : 'органика');
      // Лиды канала: max(по source, по точным кодам) — берём больше, чтоб не терять «без кода».
      const ch_leads = Math.max(m?.leads ?? 0, f?.leads ?? 0);
      const ch_leads_attributed = m?.leads_attributed ?? f?.leads ?? 0;
      const ch_couriers = m?.couriers ?? 0;
      const actual_cr = f && f.audience > 0 && ch_leads > 0
        ? Math.round((ch_leads / f.audience) * 100000) / 1000
        : null;
      const cr_to_courier = ch_leads > 0 && ch_couriers > 0
        ? Math.round((ch_couriers / ch_leads) * 1000) / 10
        : null;
      const cpl = f && f.cost > 0 && ch_leads > 0 ? Math.round(f.cost / ch_leads) : null;
      return {
        key: ch.key,
        name: ch.name,
        tier: ch.tier,
        status,
        planned_audience: ch.planned_audience,
        actual_posts: f?.posts ?? 0,
        actual_audience: f?.audience ?? 0,
        actual_leads: ch_leads,
        actual_leads_attributed: ch_leads_attributed,    // ТЗ-078: к конкретному посту
        actual_couriers: ch_couriers,                    // ТЗ-078: вышли на линию (online/retained)
        actual_views: f?.views ?? 0,
        views_seen: f?.views_seen ?? false,
        actual_cost: f?.cost ?? 0,
        actual_cpl: cpl,
        today_posts: f?.today_posts ?? 0,
        today_audience: f?.today_audience ?? 0,
        actual_deleted: f?.deleted ?? 0,
        actual_blocked: f?.blocked ?? 0,
        actual_comments: f?.comments ?? 0,
        actual_cr,                                       // охват → лид
        cr_to_courier,                                   // лид → курьер
      };
    });

    // 6. Мат-модель прогноза (sensitivity-таблица из KB-18 §D).
    const measured_cr_lead = totalReach > 0 ? totalLeads / totalReach : null;
    const sensitivity = [0.003, 0.001, 0.0005, 0.0001].map((cr) => ({
      cr_lead_pct: Math.round(cr * 1000) / 10,           // 0.30 / 0.10 / 0.05 / 0.01
      leads_for_target: Math.ceil(NORTH_STAR_TARGET / 0.10),  // допущение CR_hire=10% (KB-18)
      audience_for_target: Math.ceil((NORTH_STAR_TARGET / 0.10) / cr),
    }));
    const honest_note = totalLeads === 0
      ? 'Лидов 0 → CR_lead пока НЕ измерен (модель работает только после первых лидов). Сейчас прогноз = диапазон.'
      : `CR_lead = ${(measured_cr_lead! * 100).toFixed(4)} % (по факту ${totalLeads} лидов / ${totalReach.toLocaleString('ru-RU')} охвата). Диапазон сужается с каждым новым лидом (Байес).`;

    // 7. «Лучшее» — топ A/B-вариант, час, канал (по CR).
    const byVariantMap: Record<string, { leads: number; audience: number }> = {};
    const byHourMap: Record<number, { leads: number; audience: number }> = {};
    for (const r of srcRows) {
      const c = r.config ?? {};
      const code = str(c.code);
      const audience = num(c.audience) ?? 0;
      const leads = code ? (leadsByCode[code] ?? 0) : 0;
      const variant = str(c.post_ref) ?? '—';
      byVariantMap[variant] = byVariantMap[variant] || { leads: 0, audience: 0 };
      byVariantMap[variant].leads += leads; byVariantMap[variant].audience += audience;
      const placed = str(c.placed_at) ?? r.created_at;
      const d = new Date(placed);
      if (!Number.isNaN(d.getTime())) {
        const h = (d.getUTCHours() + 3) % 24;
        byHourMap[h] = byHourMap[h] || { leads: 0, audience: 0 };
        byHourMap[h].leads += leads; byHourMap[h].audience += audience;
      }
    }
    function topByCr<T>(items: Array<T & { leads: number; audience: number }>) {
      const withCr = items
        .filter((i) => i.audience > 0)
        .map((i) => ({ ...i, cr: i.leads / i.audience }))
        .sort((a, b) => b.cr - a.cr);
      return withCr[0] ?? null;
    }
    const bestVariant = topByCr(Object.entries(byVariantMap).map(([variant, v]) => ({ variant, ...v })));
    const bestHour    = topByCr(Object.entries(byHourMap).map(([hour, v]) => ({ hour: Number(hour), ...v })));
    const bestChannel = topByCr(Object.entries(factByChannel).map(([channel, v]) => ({ channel, ...v })));

    // 8. North Star
    const days_left = Math.max(0, Math.ceil((new Date(NORTH_STAR_DEADLINE).getTime() - Date.now()) / 86_400_000));

    // ТЗ-078: суммарные лиды по каналу (а не только по точному коду). Берём max,
    // чтобы не терять органик-лидов вроде `source='vk_seed'` без post-code.
    const totalChannelLeads = Object.values(channelMetrics).reduce((s, v) => s + v.leads, 0);
    const totalLeadsEffective = Math.max(totalLeads, totalChannelLeads);

    return NextResponse.json({
      funnel: {
        reach: totalReach,
        leads: totalLeadsEffective,                        // ТЗ-078: лиды по source (vk:/tg:/landing/…), не только по точному коду
        leads_attributed: totalLeads,                      // оставлено: лиды с точным source_code (post-attribution)
        hires,
        couriers: hires,                                   // ТЗ-078: alias для UI «🚖 Курьеры»
        views: totalViews,                                 // ТЗ-074: ③ «реально увидели»
        views_available: anyViewsAvailable,                // если false — honest «н/д для органики»
        cost: totalCost,                                   // Σ по всем каналам (₽)
        avg_cpl: totalCost > 0 && totalLeadsEffective > 0 ? Math.round(totalCost / totalLeadsEffective) : null,
        cpc: totalCost > 0 && hires > 0 ? Math.round(totalCost / hires) : null,  // ТЗ-078: cost per courier
        cr_lead: totalReach > 0 ? totalLeadsEffective / totalReach : null,        // охват → лид
        cr_lead_to_courier: totalLeadsEffective > 0 ? hires / totalLeadsEffective : null,  // ТЗ-078
        cr_reach_to_courier: totalReach > 0 ? hires / totalReach : null,         // ТЗ-078
        cr_hire: totalLeadsEffective > 0 ? hires / totalLeadsEffective : null,    // legacy alias = cr_lead_to_courier
      },
      north_star: {
        target: NORTH_STAR_TARGET,
        deadline: NORTH_STAR_DEADLINE,
        current: hires,
        days_left,
        progress_pct: Math.round((hires / NORTH_STAR_TARGET) * 100),
      },
      forecast: {
        measured_cr_lead,
        sensitivity,
        honest_note,
        assumptions: 'CR_hire=10% (бенчмарк, KB-18 §D). После накопления своих данных — апостериорный пересчёт.',
      },
      plan_fact,
      best: {
        variant: bestVariant ? { variant: (bestVariant as { variant: string }).variant, leads: bestVariant.leads, audience: bestVariant.audience, cr_pct: Math.round(bestVariant.cr * 100000) / 1000 } : null,
        hour:    bestHour    ? { hour: (bestHour as { hour: number }).hour, leads: bestHour.leads, audience: bestHour.audience, cr_pct: Math.round(bestHour.cr * 100000) / 1000 } : null,
        channel: bestChannel ? { channel: (bestChannel as { channel: string }).channel, leads: bestChannel.leads, audience: bestChannel.audience, cr_pct: Math.round(bestChannel.cr * 100000) / 1000 } : null,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

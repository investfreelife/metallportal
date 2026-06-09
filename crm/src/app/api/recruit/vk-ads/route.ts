import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/vk-ads
 *
 * ТЗ-079: список VK-объявлений из реестра channels (kind='vkads_ad').
 * Возвращает массив normalized ads + статичный список CTA + кампания.
 *
 * Источник правды (засеял мозг): channels где config.kind='vkads_ad'.
 * Поля config: code, creative_ref, source_banner_ref, format, status,
 * vk_texts {title_40_vkads, text_90, title_30_additional, text_long,
 * about_company_115, cta}, link, design_sizes, design_brief, design_rules,
 * images {image_607x1080, image_600x600, image_1080x607, icon_256x256},
 * slides [url×3..6], budget_day, paused, last_pushed_at.
 */
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  name: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  config: Record<string, unknown> | null;
}

function str(v: unknown): string | null { return typeof v === 'string' ? v : null; }
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('channels')
      .select('id, name, status, created_at, updated_at, config')
      .eq('tenant_id', tenantId)
      .filter('config->>kind', 'eq', 'vkads_ad')
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Row[];
    const ads = rows.map((r) => {
      const c = (r.config ?? {}) as Record<string, unknown>;
      const texts = (c.vk_texts && typeof c.vk_texts === 'object' ? c.vk_texts : {}) as Record<string, unknown>;
      const images = (c.images && typeof c.images === 'object' ? c.images : {}) as Record<string, unknown>;
      const slides = Array.isArray(c.slides) ? c.slides.filter((s) => typeof s === 'string') as string[] : [];
      return {
        id: r.id,
        name: r.name ?? str(c.name) ?? str(c.code) ?? '—',
        code: str(c.code),
        format: (str(c.format) ?? 'banner') as 'banner' | 'carousel',
        status: str(c.status) ?? 'awaiting_design',
        link: str(c.link) ?? null,
        creative_ref: str(c.creative_ref),
        source_banner_ref: str(c.source_banner_ref),
        vk_texts: {
          title_40_vkads:        str(texts.title_40_vkads) ?? '',
          text_90:               str(texts.text_90) ?? '',
          title_30_additional:   str(texts.title_30_additional) ?? '',
          about_company_115:     str(texts.about_company_115) ?? '',
          text_long:             str(texts.text_long) ?? '',
          cta:                   str(texts.cta) ?? 'open_url',
        },
        images: {
          image_607x1080:  str(images.image_607x1080),
          image_600x600:   str(images.image_600x600),
          image_1080x607:  str(images.image_1080x607),
          icon_256x256:    str(images.icon_256x256),
        },
        slides,
        design_brief: str(c.design_brief) ?? '',
        design_sizes: str(c.design_sizes) ?? '',
        design_rules: str(c.design_rules) ?? '',
        budget_day: num(c.budget_day) ?? 1200,
        comment: str(c.comment) ?? null,
        approved: c.approved === true,
        last_pushed_at: str(c.last_pushed_at) ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    return NextResponse.json({
      ads,
      cta_options: CTA_OPTIONS,
      campaign: {
        objective: 'site_conversions',
        package: 3232,
        default_budget_day: 1200,
        target: 'Москва+МО, 18–45, работа/подработка/курьер/авто/переезд',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

/**
 * POST /api/recruit/vk-ads — создать новое объявление (мозг засеивает,
 * но можно вручную). Минимум: code, name. Остальное — дефолтами.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().slice(0, 60) : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
    if (!code) return NextResponse.json({ error: 'code обязателен' }, { status: 400 });

    const supabase = await createClient();
    const config: Record<string, unknown> = {
      kind: 'vkads_ad',
      code,
      format: body.format === 'carousel' ? 'carousel' : 'banner',
      status: 'awaiting_design',
      vk_texts: body.vk_texts ?? {},
      link: body.link ?? `https://t.me/stolica_dostavka_bot?start=${code}`,
      budget_day: typeof body.budget_day === 'number' ? body.budget_day : 1200,
      images: {},
      slides: [],
    };
    const { data, error } = await supabase
      .from('channels').insert({
        tenant_id: tenantId,
        type: 'tracking',
        name: name || code,
        status: 'inactive',
        config,
      })
      .select('id, name, config').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ad: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

/* ───────────────────────────────────────────────────────
 *  CTA из VK (cta_sites_full — статичный список, мозг
 *  может позже обогащать через vk_ads_client.py).
 * ─────────────────────────────────────────────────────── */
const CTA_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'open_url',        label: 'Открыть сайт' },
  { key: 'open_app',        label: 'Открыть приложение' },
  { key: 'subscribe',       label: 'Подписаться' },
  { key: 'join',            label: 'Вступить' },
  { key: 'order',           label: 'Заказать' },
  { key: 'buy',             label: 'Купить' },
  { key: 'register',        label: 'Зарегистрироваться' },
  { key: 'sign_up',         label: 'Записаться' },
  { key: 'call_now',        label: 'Позвонить' },
  { key: 'write',           label: 'Написать' },
  { key: 'go_to_telegram',  label: 'Перейти в Telegram' },
  { key: 'more',            label: 'Подробнее' },
  { key: 'try_free',        label: 'Попробовать бесплатно' },
  { key: 'job_apply',       label: 'Откликнуться' },
];

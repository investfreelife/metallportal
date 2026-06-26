// Атрибуция «мирового уровня» — короткий непрозрачный код на КАЖДУЮ публикацию.
// Ссылка несёт только код (≤64 симв, [A-Za-z0-9_-] — лимит Telegram start-payload),
// весь контекст (где/когда/какой пост/сегмент) лежит в реестре channels(kind=source_codes)
// и достаётся по коду на сервере. Так работают Branch/AppsFlyer/bit.ly: link=ID → lookup.
//
// Поток: при постинге mintSourceCode() чеканит код + пишет строку реестра →
// {LINK} в тексте заменяется на t.me/<bot>?start=<код> → после успеха attachPostUrl()
// дописывает ссылку на живой пост. Бот в /start пишет код в contacts.source_code
// (first-touch, один раз) → JOIN по коду = полная атрибуция «кто откуда и когда».
import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// base62 — безопасен для Telegram start-payload (без '-'/'_' проблем экранирования).
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Короткий случайный код (7 симв base62 ≈ 3.5e12 вариантов — коллизии ничтожны). */
export function genCode(len = 7): string {
  const b = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

export const BOT_USERNAME = process.env.BOT_USERNAME || 'stolica_dostavka_bot';

/** Кликабельная deep-link на бота с кодом атрибуции. */
export function botLink(code: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${code}`;
}

export type MintCtx = {
  channel: string;            // 'vk' | 'telegram'
  placement: string;          // ГДЕ: screen_name группы / @канал / label connection
  postRef?: string | null;    // КАКОЙ пост: ad_variants.label / content_posts.id
  segment?: string | null;    // сегмент креатива (priezzhiy/mestnyy/novichok/...)
  campaign?: string | null;
  placedAt: string;           // КОГДА: ISO timestamp публикации
};

/**
 * Чеканит уникальный код публикации + пишет строку реестра в channels(kind=source_codes).
 * Возвращает { code, link }. best-effort на запись реестра не делаем — код обязан
 * быть записан, иначе атрибуция потеряется; ошибку пробрасываем вызывающему.
 */
export async function mintSourceCode(
  supabase: SupabaseClient,
  tenantId: string,
  ctx: MintCtx
): Promise<{ code: string; link: string }> {
  const code = genCode();
  const { error } = await supabase.from('channels').insert({
    tenant_id: tenantId,
    type: 'tracking',
    status: 'active',
    name: `🔗 ${ctx.channel}:${ctx.placement}${ctx.postRef ? ` · ${ctx.postRef}` : ''}`,
    config: {
      kind: 'source_codes',
      code,
      channel: ctx.channel,
      placement: ctx.placement,
      post_ref: ctx.postRef ?? null,
      segment: ctx.segment ?? null,
      campaign: ctx.campaign ?? null,
      placed_at: ctx.placedAt,
    },
  });
  if (error) throw new Error(`mintSourceCode: ${error.message}`);
  return { code, link: botLink(code) };
}

/** Дописать в строку реестра ссылку на живой пост (после успешной публикации). */
export async function attachPostUrl(
  supabase: SupabaseClient,
  tenantId: string,
  code: string,
  postUrl: string
): Promise<void> {
  const { data } = await supabase
    .from('channels')
    .select('id, config')
    .eq('tenant_id', tenantId)
    .eq('type', 'tracking')
    .filter('config->>kind', 'eq', 'source_codes')
    .filter('config->>code', 'eq', code)
    .limit(1);
  const row = Array.isArray(data) && data[0];
  if (row) {
    await supabase
      .from('channels')
      .update({ config: { ...row.config, post_url: postUrl } })
      .eq('id', row.id);
  }
}

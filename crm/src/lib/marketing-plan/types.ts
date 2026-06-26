// Типы Маркетинг-планировщика — копия src/lib/content/types.ts с маппингом
// на ad_variants (как пост) и campaigns (как тема). Sergey directive 2026-06-04,
// task 050: «механическая копия Контент-планировщика для маркетинга».
//
// Маппинг:
//   ContentPost.body          → MarketingPost.text
//   ContentPost.title         → MarketingPost.label
//   ContentPost.photo_url     → MarketingPost.photo_url      (как есть)
//   ContentPost.status        → MarketingPost.status (ready/approved/draft/...)
//   ContentPost.scheduled_at  → MarketingPost.scheduled_at  (новая колонка)
//   ContentPost.published_at  → MarketingPost.published_at  (новая колонка)
//   ContentPost.channel       → MarketingPost.channel       (новая колонка)
//   ContentPost.note          → MarketingPost.note          (как есть)

import type { FeedbackEntry, PhotoOption, RedoFlag } from '@/lib/content/types';

/** Статусы маркетинг-поста — поверх ad_variants.status. Объединяет:
 *   • набор Контент-планировщика (text_review, awaiting_photo, photo_review,
 *     ready, scheduled, published, rejected, error) — нужен чтобы скопированный
 *     PostEditor работал 1-в-1;
 *   • набор маркетинговых вариантов (draft, ready, revise, approved) —
 *     уже используется мозгом в /marketing.
 *  PostEditor рендерит лейблы только для своих, остальные просто проходят как
 *  строки в БД. */
export type MarketingPostStatus =
  | 'draft'
  | 'text_review'
  | 'awaiting_photo'
  | 'photo_review'
  | 'ready'
  | 'revise'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'redo'
  | 'error';

/** Куда публикуем маркетинг-пост. */
export type MarketingChannel = 'telegram' | 'vk';

/** Пост маркетинг-планировщика — строка ad_variants с добавленными
 *  scheduled_at / published_at / channel. */
export interface MarketingPost {
  id: string;
  tenant_id: string;
  /** ID кампании-сегмента (campaigns.id) — аналог content_themes.id. */
  campaign_id: string | null;
  /** Короткая метка варианта («A/B/C» или «Лето · оффер 1»). */
  label: string | null;
  /** Текст поста (body в Контенте). */
  text: string | null;
  photo_url: string | null;
  utm: string | null;
  status: MarketingPostStatus | string | null;
  sent_count: number | null;
  note: string | null;

  // ── Новые поля, добавлены миграцией 20260604220000_ad_variants_scheduling.sql
  scheduled_at: string | null;
  published_at: string | null;
  channel: MarketingChannel | string | null;

  // ── Зеркало feature-колонок content_posts — чтобы PostEditor работал 1-в-1.
  n: number | null;
  photo_tz: string | null;
  approved_text: boolean | null;
  approved_final: boolean | null;
  comment_text: string | null;
  comment_photo: string | null;
  redo: RedoFlag | null;
  feedback: FeedbackEntry[] | null;
  photo_options: PhotoOption[] | null;
  photos: string[] | null;
  channels_sel: string[] | null;
  updated_at: string | null;

  created_at: string;
}

/** Статус кампании (campaigns.status). */
export type MarketingThemeStatus = 'draft' | 'active' | 'paused' | 'done';

export const MARKETING_THEME_STATUS_LABELS: Record<MarketingThemeStatus, string> = {
  draft: 'Идея',
  active: 'В работе',
  paused: 'Пауза',
  done: 'Завершена',
};

export const MARKETING_THEME_STATUS_COLORS: Record<MarketingThemeStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  done: 'bg-blue-100 text-blue-700 border-blue-200',
};

/** Кампания (campaigns) — аналог content_themes для маркетинг-плана. */
export interface MarketingTheme {
  id: string;
  tenant_id: string;
  name: string | null;
  objective: string | null;
  audience: string | null;
  segment: string | null;
  portrait: string | null;
  seg_order: number | null;
  status: string | null;
  created_at: string;
}

export const MARKETING_STATUS_LABELS: Partial<Record<MarketingPostStatus, string>> = {
  draft: 'Черновик',
  ready: 'Готов · ждёт согласования',
  revise: 'На правке',
  approved: 'Согласован',
  scheduled: 'Запланирован',
  published: 'Опубликован',
  rejected: 'Отклонён',
  error: 'Ошибка публикации',
};

export const MARKETING_STATUS_COLORS: Partial<Record<MarketingPostStatus, string>> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  ready: 'bg-amber-100 text-amber-800 border-amber-200',
  revise: 'bg-orange-100 text-orange-700 border-orange-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  published: 'bg-emerald-600 text-white border-emerald-700',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  error: 'bg-red-100 text-red-700 border-red-300',
};

export const MARKETING_CHANNEL_LABELS: Record<MarketingChannel, string> = {
  telegram: '✈️ Telegram',
  vk: '🔵 ВКонтакте',
};

/** Пост готов к публикации — фото + status='approved'. */
export function isMarketingPublishable(
  p: Pick<MarketingPost, 'photo_url' | 'status'>
): boolean {
  return !!p.photo_url && p.status === 'approved';
}

/** Сгруппировать кампании по segment (UI-аналог groupByRubric). */
export function groupBySegment(
  themes: MarketingTheme[]
): Array<[string, MarketingTheme[]]> {
  const map = new Map<string, MarketingTheme[]>();
  for (const t of themes) {
    const key = t.segment || 'Без сегмента';
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}

/** Сгруппировать посты по campaign_id (для статичной табличной выкладки). */
export function groupByCampaign(
  posts: MarketingPost[]
): Array<[string, MarketingPost[]]> {
  const map = new Map<string, MarketingPost[]>();
  for (const p of posts) {
    const key = p.campaign_id || 'no-campaign';
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}

// Re-export shared интерфейсов из контента — они не зависят от схемы
// post-таблицы и применимы 1-в-1.
export type { FeedbackEntry, PhotoOption, RedoFlag };
export { CAROUSEL_LIMIT } from '@/lib/content/types';

/**
 * UI-alias: PostEditor (копия из /content) зовёт `isPublishable(post)` —
 * чтобы не патчить копированный код, экспортируем под тем же именем.
 * Логика: есть фото + либо approved_final, либо status='approved'
 * (контент использует approved_final boolean; ad_variants — status text).
 */
export function isPublishable(
  p: Pick<MarketingPost, 'photo_url' | 'approved_final' | 'status'>
): boolean {
  return !!p.photo_url && (!!p.approved_final || p.status === 'approved');
}

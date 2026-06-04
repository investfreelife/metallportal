// Типы планировщика контента — для UI + API.
// Sergey directive 2026-06-03 — своя замена Postiz, calendar + согласование.

export type PostStatus =
  | 'draft'           // только создан, текст пишется
  | 'text_review'     // ждёт согласования текста
  | 'awaiting_photo'  // текст ок, ждём фото (по ТЗ photo_tz)
  | 'photo_review'    // фото загружено, ждёт финал-согласования
  | 'ready'           // approved_final=true, можно публиковать
  | 'scheduled'       // запланирован на scheduled_at
  | 'published'       // опубликован, см. note (url)
  | 'rejected'        // отклонён, в архив
  | 'error';          // ошибка публикации, см. note

/** Запись истории «переделанных» правок — пишется фоновым воркером. */
export interface FeedbackEntry {
  target: 'text' | 'photo';
  comment: string;
  applied_at?: string | null;
}

/** Флаг «переделать» — кладёт фронт, читает воркер. После переделки воркер
 *  сбрасывает соответствующий ключ.
 *  - text/photo  → переделать существующий по комменту
 *  - variants    → сгенерить набор кандидатов в photo_options (дешёвый Flux) */
export interface RedoFlag {
  text?: boolean;
  photo?: boolean;
  variants?: boolean;
}

/** Вариант фото-кандидата — воркер кладёт в photo_options[]. */
export interface PhotoOption {
  url: string;
  model?: string | null;
  cost?: number | string | null;
  seed?: number | string | null;
  /** Тип варианта — для подписи и подсказки «обложка/инфографика». */
  kind?: 'photo' | 'cover' | 'info' | string | null;
}

/** Telegram-лимит для альбома. */
export const CAROUSEL_LIMIT = 10;

export interface ContentPost {
  id: string;
  tenant_id: string;
  n: number | null;
  title: string | null;
  body: string | null;
  photo_url: string | null;
  photo_tz: string | null;
  channel: string | null;
  status: PostStatus | string | null;
  scheduled_at: string | null;
  published_at: string | null;
  approved_text: boolean | null;
  approved_final: boolean | null;
  note: string | null;
  comment_text: string | null;
  comment_photo: string | null;
  redo: RedoFlag | null;
  feedback: FeedbackEntry[] | null;
  photo_options: PhotoOption[] | null;
  /**
   * Карусель — ВЫБРАННЫЕ для поста URL'ы по порядку. Telegram отправит
   * альбомом если >1. photo_url хранится для обратной совместимости
   * = photos[0] (если photos непустой).
   */
  photos: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionRow {
  id: string;
  tenant_id: string;
  platform: 'telegram' | 'vk';
  label: string;
  token: string;          // не возвращать клиенту в открытом виде — маскировать
  target_id: string;
  enabled: boolean;
  meta: { check_info?: string; last_checked_at?: string; last_error?: string } | null;
  created_at: string;
  updated_at: string;
}

/**
 * Маска токена: «1234…abcd». Безопасно отдавать в JSON клиенту,
 * чтобы UI знал что токен задан, но не светил его в DOM.
 */
export function maskToken(t: string | null | undefined): string {
  if (!t) return '';
  if (t.length <= 8) return '••••';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/**
 * Whether a post может быть запланирован/опубликован.
 * Жёсткое правило UI: фото + финал-согласование обязательны.
 */
export function isPublishable(p: Pick<ContentPost, 'photo_url' | 'approved_final'>): boolean {
  return !!p.photo_url && !!p.approved_final;
}

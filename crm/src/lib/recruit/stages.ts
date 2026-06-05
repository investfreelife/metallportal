// Стадии воронки (Task 056) — единый источник правды для UI + API.
// Источник: knowledge-base/14_dozhim_and_crm_stages.md §2.

export type FunnelStage =
  | 'new'         // только зашёл, бот ещё не успел ответить
  | 'contact'     // бот ответил, кандидат прочитал
  | 'qualified'   // дали короткие данные (город/права/часы)
  | 'engaged'     // активный диалог, есть возражения/обещания
  | 'agreed'      // согласился оформиться («Хочу работать»)
  | 'docs'        // на оформлении документов
  | 'scheduled'   // назначен день старта / выход на линию
  | 'online'      // вышел на линию (первая смена)
  | 'retained'    // 2-я неделя и дальше — удержание
  | 'sleeping'    // спит, ждём re-touch (по reactivate_at)
  | 'lost'        // потеряли (lost_reason)
  | 'spam';       // спам/мусор

export const STAGE_ORDER: FunnelStage[] = [
  'new', 'contact', 'qualified', 'engaged', 'agreed',
  'docs', 'scheduled', 'online', 'retained',
  'sleeping', 'lost', 'spam',
];

export const STAGE_LABELS: Record<FunnelStage, string> = {
  new:       '🆕 Новые',
  contact:   '👋 Прочитал',
  qualified: '📋 Квалифицирован',
  engaged:   '💬 В диалоге',
  agreed:    '✅ Согласился',
  docs:      '📄 Документы',
  scheduled: '📅 День старта',
  online:    '🏁 На линии',
  retained:  '🔄 Удержан',
  sleeping:  '😴 Спит',
  lost:      '❌ Потерян',
  spam:      '🚫 Спам',
};

export const STAGE_COLORS: Record<FunnelStage, string> = {
  new:       'bg-blue-50 text-blue-700 border-blue-200',
  contact:   'bg-sky-50 text-sky-700 border-sky-200',
  qualified: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  engaged:   'bg-violet-50 text-violet-700 border-violet-200',
  agreed:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  docs:      'bg-amber-50 text-amber-700 border-amber-200',
  scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  online:    'bg-green-100 text-green-800 border-green-300',
  retained:  'bg-teal-100 text-teal-800 border-teal-300',
  sleeping:  'bg-gray-100 text-gray-600 border-gray-200',
  lost:      'bg-red-50 text-red-600 border-red-200',
  spam:      'bg-red-100 text-red-700 border-red-300',
};

/** Активные стадии 0–6 — те, где требуется next_touch_at и SLA. */
export const ACTIVE_STAGES: FunnelStage[] = [
  'new', 'contact', 'qualified', 'engaged', 'agreed', 'docs', 'scheduled',
];

/** Стадия активная (= требуется next_touch_at)? */
export function isActiveStage(s: string | null | undefined): boolean {
  return !!s && (ACTIVE_STAGES as string[]).includes(s);
}

/** Допустимое движение вперёд (без отката). sleeping/lost/spam — всегда можно. */
export function canMoveTo(from: string | null, to: FunnelStage): boolean {
  if (!from) return true;
  if (to === 'sleeping' || to === 'lost' || to === 'spam') return true;
  const fromIdx = STAGE_ORDER.indexOf(from as FunnelStage);
  const toIdx = STAGE_ORDER.indexOf(to);
  if (fromIdx < 0) return true;
  return toIdx >= fromIdx;
}

export interface FunnelContact {
  id: string;
  full_name: string | null;
  telegram_chat_id: string | null;
  stage: FunnelStage | string | null;
  segment: string | null;
  city: string | null;
  has_car: boolean | null;
  next_touch_at: string | null;
  touch_count: number | null;
  last_direction: string | null;
  objections: Array<Record<string, unknown>> | null;
  promises: Array<Record<string, unknown>> | null;
  ready_date: string | null;
  lost_reason: string | null;
  do_not_contact: boolean | null;
  source: string | null;
  source_code: string | null;
  entry_segment: string | null;
  human_locked: boolean | null;
  created_at: string;
  /** Последняя реплика (in/out) — для предпросмотра в карточке. */
  last_text: string | null;
  last_at: string | null;
}

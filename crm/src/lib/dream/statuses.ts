/**
 * Единые русские лейблы статусов Мечты (TASK_022/024).
 * Используются ВЕЗДЕ: канбаны, карточка, досье, таймлайн, журнал.
 * Любая новая страница импортирует отсюда, чтобы не было разнобоя.
 */

export const BUILD_STATUS_RU: Record<string, string> = {
  parsed:        'Спарсен',
  enriching:     'Идёт проверка',
  plan_proposed: 'План готов',
  approved:      'Утверждён',
  building:      'Сборка сайта',
  built:         'Сайт собран',
  review_built:  'Проверка сайта',
  for_sale:      'В продаже',
  selling:       'Продаётся',
  sold:          'Продан',
  lost:          'Отказ',
  trash:         'В мусоре',
}

export const SALES_STAGE_RU: Record<string, string> = {
  site_ready:   'Сайт готов',
  to_call:      'К обзвону',
  no_answer:    'Недозвон',
  reached:      'Дозвонились',
  qualified:    'Квалифицирован',
  link_sent:    'Ссылка отправлена',
  negotiating:  'Переговоры',
  callback:     'Перезвонить',
  won:          'Куплен',
  lost:         'Отказ',
  disqualified: 'Не целевой',
}

/**
 * Единый whitelist sales_stage значений — источник правды.
 * Импортируется в `/api/dream/leads/[slug]/stage/route.ts` чтобы валидация
 * совпадала с UI-выпадашками и канбаном (TASK_030 #2).
 */
export const SALES_STAGES = Object.keys(SALES_STAGE_RU) as readonly string[]

/** Активные (не закрытые) sales_stage — то, что в воронке. */
export const ACTIVE_SALES_STAGES = SALES_STAGES.filter(
  (s) => !['won','lost','disqualified'].includes(s)
)

export const QUALIFICATION_RU: Record<string, string> = {
  qualified:    'Целевой',
  disqualified: 'Не целевой',
  unknown:      'Не определён',
  callback:     'Перезвонить',
}

export const CHANNEL_RU: Record<string, string> = {
  voice: 'Звонок', sms: 'СМС', email: 'Email',
  telegram: 'Telegram', whatsapp: 'WhatsApp', max: 'MAX', vk: 'ВКонтакте',
}

/**
 * Канал-источник лида (TASK_029 §5 + TASK_030 #2).
 * Колонка `dream_leads.source`. NULL = неизвестно (обычно старый лид).
 */
export const SOURCE_RU: Record<string, { label: string; emoji: string; cls: string }> = {
  parser:           { label: 'Парсер',          emoji: '🛰',  cls: 'bg-slate-100 text-slate-700' },
  inbound_call:     { label: 'Входящий звонок', emoji: '📞', cls: 'bg-emerald-100 text-emerald-800' },
  outbound_call:    { label: 'Исходящий звонок',emoji: '📲', cls: 'bg-blue-100 text-blue-800' },
  email_inbox:      { label: 'Письмо',          emoji: '📬', cls: 'bg-amber-100 text-amber-800' },
  landing_form:     { label: 'Форма лендинга',  emoji: '📝', cls: 'bg-violet-100 text-violet-800' },
  direct_leadform:  { label: 'Лид-форма Директ',emoji: '🎯', cls: 'bg-orange-100 text-orange-800' },
  vk_leadform:      { label: 'Лид-форма VK',    emoji: '🟦', cls: 'bg-sky-100 text-sky-800' },
}

/**
 * Метаданные для отображения source с фолбэками:
 * - `lp_<slug>` (форма какого-то лендинга nimbo) → отдельный бейдж
 * - `messenger:<channel>` → отдельный бейдж
 * - неизвестный → серый "—"
 */
export function sourceMeta(source: string | null | undefined): { label: string; emoji: string; cls: string } {
  if (!source) return { label: '—', emoji: '·', cls: 'bg-gray-100 text-gray-500' }
  if (source in SOURCE_RU) return SOURCE_RU[source]
  if (source.startsWith('lp_')) {
    const slug = source.slice(3)
    return { label: `Форма · ${slug}`, emoji: '📝', cls: 'bg-violet-100 text-violet-800' }
  }
  if (source.startsWith('messenger:')) {
    const ch = source.slice(10)
    return { label: `Мессенджер · ${ch}`, emoji: '💬', cls: 'bg-cyan-100 text-cyan-800' }
  }
  return { label: source, emoji: '·', cls: 'bg-gray-100 text-gray-600' }
}

// Закрытые продажи — НЕ в основной воронке, отдельная секция.
export const CLOSED_SALES_STAGES = ['won', 'lost', 'disqualified'] as const

/** Закрытая ли продажа (won/lost/disqualified). */
export function isClosedSale(sales_stage: string | null | undefined): boolean {
  return !!sales_stage && (CLOSED_SALES_STAGES as readonly string[]).includes(sales_stage)
}

/** Tailwind палитра по build_status (для бейджей). */
export function buildStatusCls(s: string): string {
  const cls: Record<string, string> = {
    parsed: 'bg-gray-100 text-gray-700',
    enriching: 'bg-slate-100 text-slate-700',
    plan_proposed: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    building: 'bg-blue-100 text-blue-800',
    built: 'bg-blue-100 text-blue-800',
    review_built: 'bg-purple-100 text-purple-800',
    for_sale: 'bg-violet-100 text-violet-800',
    selling: 'bg-violet-100 text-violet-800',
    sold: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-700',
    trash: 'bg-gray-100 text-gray-500',
  }
  return cls[s] ?? 'bg-gray-100 text-gray-700'
}

export function salesStageCls(s: string): string {
  const cls: Record<string, string> = {
    site_ready: 'bg-blue-100 text-blue-800',
    to_call: 'bg-cyan-100 text-cyan-800',
    no_answer: 'bg-slate-100 text-slate-700',
    reached: 'bg-indigo-100 text-indigo-800',
    qualified: 'bg-emerald-100 text-emerald-800',
    link_sent: 'bg-violet-100 text-violet-800',
    negotiating: 'bg-amber-100 text-amber-800',
    callback: 'bg-orange-100 text-orange-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-700',
    disqualified: 'bg-gray-100 text-gray-500',
  }
  return cls[s] ?? 'bg-gray-100 text-gray-700'
}

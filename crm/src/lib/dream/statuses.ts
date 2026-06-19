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

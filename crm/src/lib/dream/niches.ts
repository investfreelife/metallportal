/**
 * Ниши Мечты — словарь иконок, синонимов, нормализации.
 * TASK_018: «ниш будет много, надо правильно раскладывать».
 *
 * Используется на дашбордах, канбанах, списке лидов, в карточке.
 *
 * Каноническая ниша — короткое русское название (Автосервис, Шиномонтаж, ...).
 * Свободный текст из парсера нормализуем через normalizeNiche().
 */

export interface NicheMeta {
  key: string         // ключ для URL/filter (latin slug)
  label: string       // русское название
  emoji: string       // иконка для бейджа
  color: string       // tailwind palette base (amber/blue/...)
}

/**
 * Каталог известных ниш. Можно расширять по мере появления.
 */
export const NICHES: NicheMeta[] = [
  { key: 'autoservice', label: 'Автосервис',      emoji: '🔧', color: 'amber'    },
  { key: 'tires',       label: 'Шиномонтаж',      emoji: '🛞', color: 'slate'    },
  { key: 'carwash',     label: 'Автомойка',       emoji: '🚿', color: 'sky'      },
  { key: 'detailing',   label: 'Детейлинг',       emoji: '✨', color: 'violet'   },
  { key: 'autobody',    label: 'Кузовной ремонт', emoji: '🔨', color: 'orange'   },
  { key: 'autoglass',   label: 'Автостёкла',      emoji: '🪟', color: 'cyan'     },
  { key: 'barbershop',  label: 'Барбершоп',       emoji: '💈', color: 'red'      },
  { key: 'beauty',      label: 'Салон красоты',   emoji: '💅', color: 'pink'     },
  { key: 'nails',       label: 'Маникюр',         emoji: '💅', color: 'pink'     },
  { key: 'dental',      label: 'Стоматология',    emoji: '🦷', color: 'emerald'  },
  { key: 'medical',     label: 'Клиника',         emoji: '🏥', color: 'emerald'  },
  { key: 'food',        label: 'Кафе/ресторан',   emoji: '🍽',  color: 'rose'     },
  { key: 'fitness',     label: 'Фитнес',          emoji: '💪', color: 'lime'     },
  { key: 'school',      label: 'Курсы',           emoji: '🎓', color: 'indigo'   },
  { key: 'other',       label: 'Другое',          emoji: '·',  color: 'gray'     },
]

/**
 * Синонимы → каноническая ниша.
 * Регулярки регистронезависимые. Первое совпадение — победа.
 */
const SYNONYMS: Array<{ re: RegExp; key: string }> = [
  // АВТО
  { re: /шиномонтаж|шин-монтаж|развал-схожд|балансиров/i, key: 'tires' },
  { re: /автомой|мойк[аи]|car\s*wash/i,                    key: 'carwash' },
  { re: /детейл|detailing|керамик[аи]|полировк/i,          key: 'detailing' },
  { re: /кузов|покрас|вмятин|рихтов|жестян/i,              key: 'autobody' },
  { re: /стекл|автостёк|лобов/i,                           key: 'autoglass' },
  { re: /автосервис|сто\b|то\s*авто|ремонт\s*авто|двигат|акпп|трансмис|шиномонтаж\s*и/i, key: 'autoservice' },
  // BEAUTY
  { re: /барбершоп|barbershop|муж.*стри|мужск.*парикмах/i, key: 'barbershop' },
  { re: /маникюр|педикюр|nails/i,                          key: 'nails' },
  { re: /салон\s*красот|космет|эпил|brow|brow-?bar/i,      key: 'beauty' },
  // MED
  { re: /стоматолог|зуб|denta/i,                           key: 'dental' },
  { re: /клиник|медцентр|поликлиник/i,                     key: 'medical' },
  // OTHER
  { re: /кафе|рестора|пицц|бар\b|кофейн|столов/i,          key: 'food' },
  { re: /фитнес|тренаж|gym/i,                              key: 'fitness' },
  { re: /курсы|школа|обуч/i,                               key: 'school' },
]

const BY_KEY = new Map(NICHES.map((n) => [n.key, n]))
const FALLBACK: NicheMeta = NICHES.find((n) => n.key === 'other')!

/** Нормализовать свободный текст ниши до канонического ключа. */
export function normalizeNiche(raw: string | null | undefined): string {
  if (!raw) return 'other'
  const t = raw.toLowerCase().trim()
  for (const s of SYNONYMS) if (s.re.test(t)) return s.key
  return 'other'
}

/** Получить метаданные ниши (иконка, цвет, русское имя). */
export function nicheMeta(raw: string | null | undefined): NicheMeta {
  const key = normalizeNiche(raw)
  return BY_KEY.get(key) ?? FALLBACK
}

/** Tailwind классы для бейджа по цвету ниши. */
export function nicheBadgeCls(color: string): string {
  const cls: Record<string, string> = {
    amber:   'bg-amber-100 text-amber-800',
    slate:   'bg-slate-100 text-slate-800',
    sky:     'bg-sky-100 text-sky-800',
    violet:  'bg-violet-100 text-violet-800',
    orange:  'bg-orange-100 text-orange-800',
    cyan:    'bg-cyan-100 text-cyan-800',
    red:     'bg-red-100 text-red-800',
    pink:    'bg-pink-100 text-pink-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    rose:    'bg-rose-100 text-rose-800',
    lime:    'bg-lime-100 text-lime-800',
    indigo:  'bg-indigo-100 text-indigo-800',
    gray:    'bg-gray-100 text-gray-700',
  }
  return cls[color] ?? cls.gray
}

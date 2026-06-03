// Московское время ВЕЗДЕ в CRM — независимо от таймзоны компьютера/браузера.
// Москва = UTC+3 круглый год (без перехода на летнее время с 2014).
// Хранение в БД — UTC (timestamptz); показ и ввод — Москва.

export const TZ = 'Europe/Moscow';
export const MSK_OFFSET = '+03:00';

// Показать дату-время в московской зоне (для календаря/карточек/логов UI).
export function fmtMsk(input: string | number | Date, withTime = true): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

// Значение для <input type="datetime-local"> в МОСКОВСКОЙ зоне (а не локальной).
// Возвращает "YYYY-MM-DDTHH:mm" как оно выглядит в Москве.
export function toMskInputValue(input?: string | number | Date): string {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Ввод из datetime-local (это МОСКОВСКОЕ настенное время) → UTC ISO для БД.
export function mskInputToUTC(value: string): string {
  // value: "YYYY-MM-DDTHH:mm" — трактуем как Москву (+03:00), переводим в UTC.
  const v = value.length === 16 ? value + ':00' : value;
  return new Date(`${v}${MSK_OFFSET}`).toISOString();
}

// "Сейчас" в Москве как Date (для значений по умолчанию и сравнения отображения).
export function nowMskInputValue(): string {
  return toMskInputValue(new Date());
}

// ── Календарные хелперы — для сетки «месяц/неделя/день» в МСК ───────
// Принцип: cell-Date представляет МОМЕНТ "00:00 МСК того дня". Все сдвиги
// идут через UTC-арифметику (millis), что корректно — Москва без DST.

/** Разобрать момент в части МСК-календаря. */
export function mskParts(input: string | number | Date): {
  year: number; month: number; day: number; hour: number; minute: number; weekday: number;
} {
  const d = new Date(input);
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  });
  const p = f.formatToParts(d).reduce<Record<string, string>>((a, x) => (a[x.type] = x.value, a), {});
  // ISO weekday: Пн=1 … Вс=7
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour, minute: +p.minute,
    weekday: dowMap[p.weekday] ?? 1,
  };
}

/** Стабильный ключ дня в МСК «YYYY-MM-DD» (для группировки постов по ячейкам). */
export function mskDayKey(input: string | number | Date): string {
  const p = mskParts(input);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Date, указывающий на 00:00 МСК того дня. */
export function mskStartOfDay(input: string | number | Date): Date {
  return new Date(`${mskDayKey(input)}T00:00:00${MSK_OFFSET}`);
}

/** Прибавить N дней (cell остаётся на 00:00 МСК). */
export function mskAddDays(input: string | number | Date, days: number): Date {
  return new Date(mskStartOfDay(input).getTime() + days * 86400000);
}

/** Прибавить N календарных месяцев (по МСК), результат — 1-е число месяца в МСК 00:00. */
export function mskAddMonths(input: string | number | Date, months: number): Date {
  const p = mskParts(input);
  // нормализуем (год, месяц) после сдвига
  const totalMonths = (p.year * 12 + (p.month - 1)) + months;
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1;
  return new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00${MSK_OFFSET}`);
}

/** Понедельник ISO-недели в МСК для указанного момента (00:00 МСК понедельника). */
export function mskStartOfWeek(input: string | number | Date): Date {
  const p = mskParts(input);
  const start = mskStartOfDay(input);
  return new Date(start.getTime() - (p.weekday - 1) * 86400000);
}

/** Первое число месяца МСК для указанного момента. */
export function mskStartOfMonth(input: string | number | Date): Date {
  const p = mskParts(input);
  return new Date(`${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00${MSK_OFFSET}`);
}

/** Сравнение «одинаковый ли это календарный день по МСК». */
export function isSameMskDay(a: string | number | Date, b: string | number | Date): boolean {
  return mskDayKey(a) === mskDayKey(b);
}

/** Лейбл дня для шапки колонки недели «02.06» (в МСК). */
export function mskShortDay(input: string | number | Date): string {
  const p = mskParts(input);
  return `${String(p.day).padStart(2, '0')}.${String(p.month).padStart(2, '0')}`;
}

/** Лейбл «понедельник 02.06» (в МСК) для day-view header. */
export function mskWeekdayLongDate(input: string | number | Date): string {
  const d = new Date(input);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long',
  }).format(d);
}

/** Лейбл «июнь 2026» (в МСК) для month-view header. */
export function mskMonthYear(input: string | number | Date): string {
  const d = new Date(input);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ, month: 'long', year: 'numeric',
  }).format(d);
}

/**
 * Безопасный экранизатор search-параметра для PostgREST `.or()` / `.ilike()`.
 *
 * CWE-943 (TASK_030): атакующий мог через `?search=` вырваться из ilike
 * на PostgREST уровне — запятые делят условия в `.or()`, скобки группируют,
 * процент = wildcard. Пример эксплойта:
 *   ?search=foo,id.gt.0,bar.ilike.%25
 * становилось:
 *   .or('name.ilike.%foo,id.gt.0,bar.ilike.%25%,...')
 * → возвращало все строки (id > 0).
 *
 * Решение: режем длину, выкидываем PostgREST-метасимволы и SQL-LIKE
 * wildcards, оставляем буквы/цифры/пробел/тире/точку/@/+/русский.
 */
const SAFE_RE = /[^A-Za-zА-Яа-яЁё0-9 .\-_+@]/g

export function safeSearch(raw: string | null | undefined, maxLen = 50): string {
  if (!raw) return ''
  return String(raw).slice(0, maxLen).replace(SAFE_RE, ' ').trim()
}

/**
 * Строит безопасный `.or()` filter для PostgREST по нескольким колонкам.
 * Поля захардкожены вызывающим (whitelist) — search никогда не определяет имя поля.
 */
export function safeIlikeOr(fields: readonly string[], search: string): string {
  // `.or()` PostgREST: `field1.ilike.value,field2.ilike.value` без пробелов между.
  return fields.map(f => `${f}.ilike.%${search}%`).join(',')
}

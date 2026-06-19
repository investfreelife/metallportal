/**
 * TASK_054 (audit 2026-06-18 SEV-4): безопасный JSON-LD encoder.
 *
 * `JSON.stringify(obj)` внутри `<script type="application/ld+json">...` рискует
 * расшить страницу, если кто-то засунул строку `</script>` в данные (через
 * admin-поле / название товара). HTML-парсер заканчивает script-тег по
 * первой `</script>` независимо от кавычек → выполняется код после.
 *
 * Текущий контент schema'ов авторский / admin-only (риск низкий), но
 * helper делает escape бесплатно и закрывает класс багов навсегда.
 *
 * Дополнительно экранируем U+2028/U+2029 — в JSON они валидны, но
 * JavaScript до ES2019 трактовал их как line terminators (старые
 * скрейперы/парсеры могут на них падать).
 *
 * Источник правила: https://html.spec.whatwg.org/multipage/scripting.html
 * (раздел "script restrictions") + рекомендации OWASP по JSON-in-HTML.
 */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Контактные константы (одно место правды для телефона / email).
 *
 * Раньше телефон был хардкоднут в нескольких файлах — `app/privacy/page.tsx`,
 * `app/oferta/page.tsx`, `app/contacts/page.tsx`. Со временем нужно
 * перенести их на эти константы; сейчас минимально для CTA в
 * `CategoryInfoBlock` (W2-3).
 *
 * Долгосрочно — табличка `site_settings(key, value)` или env-переменная
 * с поддержкой админки. Сейчас фиксированные строки достаточно.
 */

/** Отображаемый формат: "+7 (499) 325-39-69" */
export const CONTACT_PHONE_DISPLAY = "+7 (499) 325-39-69";

/** tel:-формат без пробелов и скобок: "+74993253969" */
export const CONTACT_PHONE_TEL = "+74993253969";

/** Email клиентского отдела */
export const CONTACT_EMAIL = "info@harlansteel.ru";

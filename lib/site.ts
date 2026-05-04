/**
 * Canonical site URL — single source of truth.
 *
 * Override через env (preview/staging). Production по умолчанию —
 * `https://www.harlansteel.ru` (apex `harlansteel.ru` 301 → www через
 * Cloudflare). Используй везде вместо hardcoded строк, чтобы домен
 * можно было поменять одной env-переменной.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.harlansteel.ru";

export const SITE_NAME = "Харланметалл";

/** Host без протокола — для robots.txt `Host:` директивы Yandex. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

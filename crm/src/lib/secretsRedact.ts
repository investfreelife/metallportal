/**
 * Anti-secret-leak helper (TASK_030 #3).
 *
 * Используется ВЕЗДЕ где результат может попасть в логи (console.log, отчёты,
 * agent-events). Маскирует ВСЕ типичные ключи проекта, не только botToken/anthropicKey.
 *
 * Применение:
 *   import { redact } from '@/lib/secretsRedact'
 *   console.log('config:', redact({ SUPABASE_SERVICE_ROLE_KEY: '...', name: 'ok' }))
 *
 *   import { redactString } from '@/lib/secretsRedact'
 *   console.log(redactString(`Bearer ${token}`))   // строковая маска
 */

/** Имена ENV/полей которые ВСЕГДА маскируем (case-insensitive substring match). */
export const SECRET_KEY_PATTERNS = [
  'token', 'secret', 'apikey', 'api_key', 'password', 'passwd', 'pass',
  'bearer', 'auth', 'cookie', 'session_secret',
  'service_role', 'service-role',
  'anthropic', 'openrouter', 'openai',
  'supabase_service', 'supabase_anon',  // anon тоже не пускаем в логи лишний раз
  'telegram_bot', 'tg_token',
  'vercel_token', 'github_token', 'gh_token',
  'voximplant', 'elevenlabs',
  'private_key', 'private-key',
] as const

/** Регэксп для масок в свободном тексте (Bearer xxxxx, jwt-like, etc). */
const FREE_TEXT_REPLACERS: { re: RegExp; mask: (m: string) => string }[] = [
  // Bearer <token>
  { re: /(\b[Bb]earer\s+)([A-Za-z0-9._-]{8,})/g, mask: (m) => m.replace(/[A-Za-z0-9._-]{8,}$/, '[REDACTED_BEARER]') },
  // JWT (eyJ... — header.payload.sig из 3 base64 кусков)
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, mask: () => '[REDACTED_JWT]' },
  // Supabase service_role: префикс "eyJ", очень длинный
  // Telegram bot token — формат 123456:ABC-...
  { re: /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, mask: () => '[REDACTED_TG_TOKEN]' },
  // OpenRouter/Anthropic-style keys (sk-...)
  { re: /\bsk-[A-Za-z0-9-]{20,}\b/g, mask: () => '[REDACTED_API_KEY]' },
  // Vercel token (vcp_...)
  { re: /\bvcp_[A-Za-z0-9]{20,}\b/g, mask: () => '[REDACTED_VERCEL_TOKEN]' },
  // GitHub PAT (ghp_, github_pat_)
  { re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, mask: () => '[REDACTED_GH_TOKEN]' },
  // Generic long hex (40+ chars — chunks of API keys)
  // НЕ маскируем хеши коммитов/Message-ID и т.п. — слишком много ложных срабатываний.
]

/** Маскирует строку — ловит Bearer, JWT, TG, sk-, vcp_, ghp_. */
export function redactString(s: string): string {
  if (typeof s !== 'string') return s
  let out = s
  for (const { re, mask } of FREE_TEXT_REPLACERS) {
    out = out.replace(re, mask)
  }
  return out
}

function shouldRedactKey(key: string): boolean {
  const k = key.toLowerCase()
  return SECRET_KEY_PATTERNS.some((p) => k.includes(p))
}

function maskValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v === 'string') {
    if (v.length === 0) return v
    // Сохраняем длину + первые 2 символа для отладки.
    return `[REDACTED:${v.length}c]`
  }
  if (typeof v === 'number' || typeof v === 'boolean') return '[REDACTED]'
  if (Array.isArray(v)) return v.map(maskValue)
  if (typeof v === 'object') return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, val]) =>
      shouldRedactKey(k) ? [k, maskValue(val)] : [k, redact(val)]
    )
  )
  return v
}

/**
 * Рекурсивный redact для объектов: маскирует значения ключей, чьё имя
 * содержит секрет-pattern (token/secret/apikey/...). Внутри строк
 * ловит Bearer, JWT, sk-, vcp_, ghp_, TG-token-формат.
 */
export function redact<T>(value: T): T {
  if (value == null) return value
  if (typeof value === 'string') return redactString(value) as T
  if (Array.isArray(value)) return value.map(redact) as T
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = shouldRedactKey(k) ? maskValue(v) : redact(v)
    }
    return out as T
  }
  return value
}

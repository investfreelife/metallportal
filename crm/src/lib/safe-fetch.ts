/**
 * safeFetchJson — JSON-обёртка над fetch, которая корректно реагирует
 * на не-JSON ответы (Vercel Security Checkpoint, login-redirect, 5xx HTML).
 *
 * Sergey directive 2026-06-04: «проверь все окна» — раньше при срабатывании
 * Vercel Firewall (JA3/JA4) пользователь видел «HTTP 403: <!DOCTYPE html…»
 * и не понимал что делать. Теперь:
 *   • 403 + html с challenge → «🛡 Vercel защита — обнови страницу (F5)…»
 *   • 401 + любой формат → «Сессия истекла, войди заново»
 *   • 5xx HTML       → «Сервер вернул не-JSON HTTP <code>: <фрагмент>»
 *   • OK + JSON с .error → пробрасываем сам error
 *   • OK + JSON       → возвращаем результат
 */

export class FetchJsonError extends Error {
  status: number;
  bodyPreview: string;
  isVercelChallenge: boolean;
  isAuth: boolean;
  constructor(message: string, opts: { status: number; bodyPreview?: string; isVercelChallenge?: boolean; isAuth?: boolean }) {
    super(message);
    this.name = 'FetchJsonError';
    this.status = opts.status;
    this.bodyPreview = opts.bodyPreview ?? '';
    this.isVercelChallenge = !!opts.isVercelChallenge;
    this.isAuth = !!opts.isAuth;
  }
}

export async function safeFetchJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const r = await fetch(input, { cache: 'no-store', credentials: 'same-origin', ...init });
  const ct = r.headers.get('content-type') || '';

  // ── 401: вне зависимости от content-type — сессия истекла ───────
  if (r.status === 401) {
    throw new FetchJsonError('Сессия истекла. Войди заново (выйти → войти).', {
      status: 401, isAuth: true,
    });
  }

  if (!ct.includes('application/json')) {
    const text = await r.text().catch(() => '');
    // ── 403 + Vercel challenge HTML ───────────────────────────────
    const isVc =
      r.headers.has('x-vercel-challenge-token') ||
      text.includes('Vercel Security Checkpoint') ||
      /data-astro-cid-nbv56vs3/.test(text); // маркер challenge-страницы Vercel
    if (r.status === 403 && isVc) {
      throw new FetchJsonError(
        '🛡 Vercel защита: обнови страницу (F5) и попробуй снова. Firewall кратко перепроверяет браузер.',
        { status: 403, isVercelChallenge: true, bodyPreview: text.slice(0, 200) }
      );
    }
    throw new FetchJsonError(
      `Сервер ответил не-JSON (HTTP ${r.status}). Фрагмент: ${text.slice(0, 120)}`,
      { status: r.status, bodyPreview: text.slice(0, 200) }
    );
  }

  const j = await r.json().catch(() => null);
  if (!r.ok || (j && typeof j === 'object' && (j as { error?: string }).error)) {
    const errMsg = (j && (j as { error?: string }).error) || `HTTP ${r.status}`;
    throw new FetchJsonError(errMsg, { status: r.status });
  }
  return j as T;
}

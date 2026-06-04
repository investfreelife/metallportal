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

/** Авто-ретрай на Vercel-challenge: тихая пауза + 1 повтор (вернёт ту же ошибку
 *  если firewall всё ещё держит). Достаточно для типичной ситуации «cookie
 *  _vcrcs ещё не успела поставиться». */
const VC_RETRY_DELAY_MS = 800;
const VC_MAX_RETRIES = 2; // 1 исходный + 2 ретрая = 3 попытки максимум

async function singleAttempt<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const r = await fetch(input, { cache: 'no-store', credentials: 'same-origin', ...init });
  const ct = r.headers.get('content-type') || '';

  if (r.status === 401) {
    throw new FetchJsonError('Сессия истекла. Войди заново (выйти → войти).', {
      status: 401, isAuth: true,
    });
  }

  if (!ct.includes('application/json')) {
    const text = await r.text().catch(() => '');
    const isVc =
      r.headers.has('x-vercel-challenge-token') ||
      text.includes('Vercel Security Checkpoint') ||
      /data-astro-cid-nbv56vs3/.test(text);
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

export async function safeFetchJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  let lastError: unknown = null;
  for (let i = 0; i <= VC_MAX_RETRIES; i++) {
    try {
      return await singleAttempt<T>(input, init);
    } catch (e) {
      lastError = e;
      // Ретрай ТОЛЬКО на Vercel-challenge — sessions/json-errors пробрасываем сразу.
      if (e instanceof FetchJsonError && e.isVercelChallenge && i < VC_MAX_RETRIES) {
        await new Promise((res) => setTimeout(res, VC_RETRY_DELAY_MS * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

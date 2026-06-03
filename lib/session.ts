/**
 * HMAC-signed user_session cookie для site auth.
 *
 * SECURITY 2026-05-17 audit: cookie был plain `<user-id>` без подписи → trivial
 * forgery (set any UUID → impersonate любого user). Port pattern из crm/src/lib/session.ts.
 *
 * Format: `<base64url(payload)>.<base64url(hmac-sha256(payload))>`
 * payload = `{ userId, exp }` JSON.
 *
 * Legacy plain-UUID cookies: verifySessionLegacy() поддерживает временно для graceful
 * migration. После users re-login — все имеют signed cookies.
 */
import crypto from "node:crypto";

export interface SiteSession {
  userId: string;
  exp: number; // ms unix timestamp
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
}

const COOKIE_MAX_AGE_DAYS = 30;
const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE_DAYS * 86400 * 1000;

export const SESSION_COOKIE_OPTS = {
  httpOnly: true as const,
  secure: true as const,
  sameSite: "lax" as const,
  path: "/" as const,
  maxAge: COOKIE_MAX_AGE_DAYS * 86400, // seconds
};

/** Sign userId + 30d expiry. */
export function signSession(userId: string): string {
  const payload: SiteSession = {
    userId,
    exp: Date.now() + COOKIE_MAX_AGE_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

/** Verify HMAC + expiry. Returns null on ANY failure. */
export function verifySession(token: string | undefined | null): SiteSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as SiteSession;
    if (!session.userId || !session.exp) return null;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Legacy plain-UUID cookie support (для graceful migration до тех пор пока все
 * users re-login получат signed cookies).
 *
 * Detection: UUID-format string (8-4-4-4-12 hex) и нет точки. Returns userId
 * если matches UUID format, иначе null.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifySessionLegacy(token: string | undefined | null): string | null {
  if (!token) return null;
  if (token.includes(".")) return null; // looks signed, not legacy
  if (!UUID_RE.test(token)) return null;
  return token;
}

/**
 * Unified read: try signed first, fall back к legacy UUID.
 * Returns userId или null.
 */
export function readSession(token: string | undefined | null): string | null {
  const signed = verifySession(token);
  if (signed) return signed.userId;
  return verifySessionLegacy(token);
}

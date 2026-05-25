/**
 * Scrypt password hashing для site_users.
 *
 * SECURITY 2026-05-17 audit: legacy SHA-256 + single PASSWORD_SALT — слишком быстро
 * cracked GPU-based attacks. Scrypt с per-user salt + N=16384/r=8/p=1 даёт ~100ms
 * cost — приемлемо для login flow, very expensive для bulk crack.
 *
 * Migration strategy: existing users keep `password_hash` (SHA-256 v1). On next
 * login, route verifies v1 then re-hashes к v2 transparently — see /api/auth/login.
 * New registrations always используют v2 (scrypt).
 */
import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
) => Promise<Buffer>;

// N=16384, r=8, p=1 — OWASP recommended baseline (2023+). Cost ~100ms on modern CPU.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export interface ScryptHash {
  hash: string; // hex
  salt: string; // hex
}

/** Generate fresh scrypt hash + per-user salt. */
export async function hashPasswordScrypt(password: string): Promise<ScryptHash> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return { hash: derived.toString("hex"), salt };
}

/** Timing-safe verify. Returns false on ANY error / mismatch. */
export async function verifyPasswordScrypt(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  if (!password || !hash || !salt) return false;
  try {
    const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Legacy SHA-256 verify (для transparent migration в /api/auth/login).
 * После success — caller re-hashes via hashPasswordScrypt + updates row.
 */
export function verifyPasswordLegacy(password: string, storedHash: string): boolean {
  const salt = process.env.PASSWORD_SALT;
  if (!salt) return false;
  const computed = crypto.createHash("sha256").update(password + salt).digest("hex");
  // Timing-safe even for legacy path
  if (computed.length !== storedHash.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

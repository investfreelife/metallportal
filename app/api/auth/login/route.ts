/**
 * /api/auth/login — site auth with hardening (2026-05-17 critical audit).
 *
 * Security layers (defense in depth):
 *   1. Rate limit — 5 attempts / 15 min per IP (Upstash sliding window)
 *   2. Turnstile required после 3rd failed attempt в окне (frontend reads
 *      `requireCaptcha: true` из 401 response)
 *   3. Password verify — scrypt (v2) с transparent migration legacy SHA-256 (v1)
 *   4. timingSafeEqual everywhere — no timing oracle
 *   5. HMAC-signed `user_session` cookie (см. lib/session.ts)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loginRatelimit, getClientIp } from "@/lib/ratelimit";
import { hashPasswordScrypt, verifyPasswordScrypt, verifyPasswordLegacy } from "@/lib/auth/scrypt";
import { signSession, SESSION_COOKIE_OPTS } from "@/lib/session";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GENERIC_ERROR = "Неверный email или пароль";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Layer 1 — rate limit (даже до парсинга body)
  const { success: rlOk, remaining, reset } = await loginRatelimit.limit(ip);
  if (!rlOk) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите 15 минут." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    turnstileToken?: string;
  };
  const { email, password, turnstileToken } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  // Layer 2 — Turnstile required после ≥3 failures (remaining ≤ 1 на этом call).
  if (remaining <= 1 && process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return NextResponse.json(
        { error: "Требуется проверка captcha", requireCaptcha: true },
        { status: 401 },
      );
    }
    const captchaOk = await verifyTurnstile(turnstileToken, ip).catch(() => false);
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Проверка captcha не пройдена", requireCaptcha: true },
        { status: 401 },
      );
    }
  }

  // Fetch by email only (never filter password в SQL).
  const { data: user } = await supabase
    .from("site_users")
    .select(
      "id, email, full_name, ref_code, password_hash, password_hash_v2, password_salt, password_hash_version",
    )
    .eq("email", email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Layer 3 — verify по версии hash
  let verified = false;
  if (user.password_hash_version === 2 && user.password_hash_v2 && user.password_salt) {
    verified = await verifyPasswordScrypt(password, user.password_hash_v2, user.password_salt);
  } else if (user.password_hash) {
    // Legacy SHA-256 v1
    verified = verifyPasswordLegacy(password, user.password_hash);
    if (verified) {
      // Transparent migration → scrypt v2 (silent fail OK — login still works)
      try {
        const { hash, salt } = await hashPasswordScrypt(password);
        await supabase
          .from("site_users")
          .update({
            password_hash_v2: hash,
            password_salt: salt,
            password_hash_version: 2,
          })
          .eq("id", user.id);
      } catch (e) {
        console.error("[login] scrypt migration failed:", (e as Error).message);
      }
    }
  }

  if (!verified) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await supabase
    .from("site_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  // Layer 5 — HMAC-signed cookie
  const token = signSession(user.id);
  const res = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      ref_code: user.ref_code,
    },
  });
  res.cookies.set("user_session", token, SESSION_COOKIE_OPTS);
  return res;
}

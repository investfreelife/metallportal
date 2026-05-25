/**
 * /api/auth/register — site signup with hardening (2026-05-17 critical audit).
 *
 * Security:
 *   - Rate limit 3 registrations / 1h per IP (Upstash)
 *   - scrypt password hashing (v2 always для новых users)
 *   - HMAC-signed session cookie
 *   - Email lowercased + trimmed (canonical form для conflict check)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { registerRatelimit, getClientIp } from "@/lib/rateLimit";
import { hashPasswordScrypt } from "@/lib/auth/scrypt";
import { signSession, SESSION_COOKIE_OPTS } from "@/lib/session";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function genRefCode(name: string): string {
  const base =
    (name || "USER").replace(/[^a-zA-Zа-яёА-ЯЁ]/gi, "").toUpperCase().substring(0, 4) ||
    "USER";
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate limit регистраций
  const { success: rlOk, reset } = await registerRatelimit.limit(ip);
  if (!rlOk) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Слишком много регистраций. Попробуйте через час." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const { email, password, full_name, company_name, phone, ref_code } = await req
    .json()
    .catch(() => ({} as Record<string, string>));

  if (!email || !password) {
    return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Пароль минимум 8 символов" }, { status: 400 });
  }

  const normalizedEmail = email.toString().trim().toLowerCase();

  const { data: existing } = await supabase
    .from("site_users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Email уже зарегистрирован" }, { status: 400 });
  }

  // ТЗ #049: ref_code may come from body OR cookie (mp_ref set by landing на ?ref=XXX)
  let effectiveRefCode = (ref_code || "").toString().toUpperCase().trim();
  if (!effectiveRefCode) {
    const cookieRef = req.cookies.get("mp_ref")?.value;
    if (cookieRef) effectiveRefCode = cookieRef.toUpperCase().trim();
  }

  let referred_by: string | null = null;
  let referral_card = false;
  if (effectiveRefCode) {
    const { data: referrer } = await supabase
      .from("site_users")
      .select("id")
      .eq("ref_code", effectiveRefCode)
      .maybeSingle();
    if (referrer) {
      referred_by = referrer.id;
      referral_card = true; // 1% lifetime discount card per Sergey
    }
  }

  // scrypt v2 hash + per-user salt
  const { hash, salt } = await hashPasswordScrypt(password);

  const { data: user, error } = await supabase
    .from("site_users")
    .insert({
      email: normalizedEmail,
      // password_hash оставляем NULL для new users (legacy column не используется)
      password_hash_v2: hash,
      password_salt: salt,
      password_hash_version: 2,
      full_name,
      company_name,
      phone,
      ref_code: genRefCode(full_name || normalizedEmail),
      referred_by,
      referral_card,
      referred_at: referred_by ? new Date().toISOString() : null,
    } as any)
    .select("id, email, ref_code, referral_card")
    .single();

  if (error) {
    console.error("[register] insert failed:", error.message);
    return NextResponse.json({ error: "Не удалось создать аккаунт" }, { status: 500 });
  }

  // CRM contact (best-effort, не fail register если падает)
  try {
    await supabase.from("contacts").insert({
      tenant_id: "a1000000-0000-0000-0000-000000000001",
      full_name,
      company_name,
      email: normalizedEmail,
      phone,
      source: effectiveRefCode ? "referral" : "site",
      ai_score: 30,
    });
  } catch {}

  // HMAC session
  const token = signSession(user.id);
  const res = NextResponse.json({ success: true, user });
  res.cookies.set("user_session", token, SESSION_COOKIE_OPTS);
  if (effectiveRefCode) {
    res.cookies.set("mp_ref", "", { maxAge: 0, path: "/" });
  }
  return res;
}

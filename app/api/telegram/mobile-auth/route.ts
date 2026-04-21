/**
 * Мобильная авторизация через Telegram:
 * 1. Приложение генерирует code → сохраняет в Supabase pending_auth
 * 2. Пользователь открывает бота с /start mobile_<code>
 * 3. Бот подтверждает — записывает telegram_id к code
 * 4. Приложение поллит GET /api/telegram/mobile-auth?code=xxx и получает сессию
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// POST — создать pending code (вызывается из приложения)
export async function POST(req: NextRequest) {
  const code = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 мин

  await supabase.from("telegram_auth_codes").upsert({
    code,
    expires_at: expiresAt,
    confirmed: false,
    telegram_id: null,
  });

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "metallportal_bot";
  const deepLink = `https://t.me/${botUsername}?start=mobile_${code}`;

  return NextResponse.json({ code, deep_link: deepLink });
}

// GET — проверить статус кода (поллинг из приложения)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const { data } = await supabase
    .from("telegram_auth_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (!data) return NextResponse.json({ status: "not_found" });
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ status: "expired" });
  if (!data.confirmed || !data.telegram_id) return NextResponse.json({ status: "pending" });

  // Код подтверждён — выдать сессию
  const syntheticEmail = `tg_${data.telegram_id}@telegram.metallportal.app`;

  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });

  // Инвалидировать код
  await supabase.from("telegram_auth_codes").delete().eq("code", code);

  const props = linkData?.properties as any;
  return NextResponse.json({
    status: "confirmed",
    access_token: props?.access_token ?? null,
    refresh_token: props?.refresh_token ?? null,
    user_name: data.user_name,
    telegram_id: data.telegram_id,
  });
}

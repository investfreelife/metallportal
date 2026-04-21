import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Верифицирует данные от Telegram Login Widget по HMAC-SHA256 */
function verifyTelegramHash(data: Record<string, string>): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const secret = crypto.createHash("sha256").update(token).digest();
  const { hash, ...rest } = data;
  const checkStr = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");
  const hmac = crypto.createHmac("sha256", secret).update(checkStr).digest("hex");
  return hmac === hash;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, first_name, last_name, username, photo_url, hash, auth_date } = body;

    if (!hash || !id) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Проверяем не старше 1 часа
    if (Date.now() / 1000 - Number(auth_date) > 3600) {
      return NextResponse.json({ error: "Auth expired" }, { status: 401 });
    }

    if (!verifyTelegramHash(body)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const telegramId = Number(id);
    const fullName = [first_name, last_name].filter(Boolean).join(" ");
    const syntheticEmail = `tg_${telegramId}@telegram.metallportal.app`;

    // Ищем существующего пользователя по telegram_id в profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.id;
      // Обновить профиль
      await supabase.from("profiles").update({
        full_name: fullName,
        telegram_username: username ?? null,
        avatar_url: photo_url ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
    } else {
      // Создать нового пользователя через admin API
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        password: crypto.randomBytes(32).toString("hex"),
        email_confirm: true,
        user_metadata: { full_name: fullName, telegram_id: telegramId, avatar_url: photo_url },
      });

      if (createErr || !newUser.user) {
        // Пользователь уже существует — получим его
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const found = users.find(u => u.email === syntheticEmail);
        if (!found) return NextResponse.json({ error: "Cannot create user" }, { status: 500 });
        userId = found.id;
      } else {
        userId = newUser.user.id;
      }

      // Создать профиль
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email: syntheticEmail,
        telegram_id: telegramId,
        telegram_username: username ?? null,
        avatar_url: photo_url ?? null,
      }, { onConflict: "id" });

      // Создать чат
      await supabase.from("chats").upsert({
        user_id: userId,
        telegram_id: telegramId,
        telegram_username: username ?? null,
        customer_name: fullName,
        status: "open",
        last_message: "Подключился через Telegram",
        last_message_at: new Date().toISOString(),
      }, { onConflict: "telegram_id" });
    }

    // Создать magic link для входа
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });

    if (linkErr || !linkData) {
      return NextResponse.json({ error: "Cannot generate link" }, { status: 500 });
    }

    const props = linkData.properties as any;
    return NextResponse.json({
      ok: true,
      access_token: props?.access_token ?? null,
      refresh_token: props?.refresh_token ?? null,
      redirect_url: props?.action_link ?? null,
      user: { id: userId, name: fullName, username, photo_url },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

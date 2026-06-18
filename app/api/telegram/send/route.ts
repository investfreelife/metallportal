import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

/**
 * POST /api/telegram/send  (TASK_052 hardening, audit 2026-06-18 SEV-1)
 *
 * Шлёт менеджерское сообщение клиенту в Telegram и пишет manager-row в
 * `messages`. Раньше без auth — позволял любому посетителю писать клиентам
 * "от имени менеджера" + инжектить фейк-сообщения в БД.
 *
 * Теперь: требует роль admin/manager/designer. `managerId` берётся ТОЛЬКО
 * из сессии (body.managerId игнорируется, чтобы нельзя было спуфнуть автора).
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin", "manager", "designer"]);
  if (!auth.ok) return auth.error;
  const managerId = auth.userId;

  try {
    const { chatId, message } = await req.json();
    if (!chatId || !message) {
      return NextResponse.json({ error: "chatId and message required" }, { status: 400 });
    }

    // Получить telegram_id клиента
    const { data: chat } = await supabase
      .from("chats")
      .select("telegram_id, id")
      .eq("id", chatId)
      .single();

    if (!chat?.telegram_id) {
      return NextResponse.json({ error: "No telegram_id for this chat" }, { status: 404 });
    }

    // Отправить в Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat.telegram_id,
        text: `💬 Менеджер: ${message}`,
        parse_mode: "HTML",
      }),
    });
    const tgData = await tgRes.json();

    // Сохранить в messages (managerId из auth, не из body)
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_type: "manager",
      sender_id: managerId,
      content: message,
      telegram_message_id: tgData.result?.message_id ?? null,
    });

    await supabase
      .from("chats")
      .update({ last_message: message, last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    // SEV-2 fix: не отдавать сырой e.message клиенту (утечка внутренностей)
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[telegram/send] error:", msg);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

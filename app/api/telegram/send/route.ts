import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

export async function POST(req: NextRequest) {
  try {
    const { chatId, message, managerId } = await req.json();
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

    // Сохранить в messages
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_type: "manager",
      sender_id: managerId ?? null,
      content: message,
      telegram_message_id: tgData.result?.message_id ?? null,
    });

    await supabase
      .from("chats")
      .update({ last_message: message, last_message_at: new Date().toISOString() })
      .eq("id", chatId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

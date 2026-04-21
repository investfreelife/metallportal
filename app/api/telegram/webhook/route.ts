import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body.message;
    if (!msg) return NextResponse.json({ ok: true });

    const tgId: number = msg.from.id;
    const tgUsername: string = msg.from.username ?? "";
    const firstName: string = msg.from.first_name ?? "";
    const text: string = msg.text ?? "";

    // /start — регистрация / приветствие
    if (text.startsWith("/start")) {
      const token = text.split(" ")[1]; // /start <token> для авторизации

      // Сохранить/обновить чат
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .eq("telegram_id", tgId)
        .single();

      if (!existingChat) {
        await supabase.from("chats").insert({
          telegram_id: tgId,
          telegram_username: tgUsername,
          customer_name: firstName,
          status: "open",
          last_message: "Начал диалог",
          last_message_at: new Date().toISOString(),
        });
      }

      await sendTelegram(
        tgId,
        `👋 Привет, <b>${firstName}</b>!\n\nДобро пожаловать в МеталлПортал.\n\nЗдесь вы можете:\n• Задать вопрос менеджеру\n• Узнать статус заказа\n• Получить консультацию\n\nПросто напишите ваш вопрос 👇`
      );
      return NextResponse.json({ ok: true });
    }

    // Обычное сообщение — сохранить и уведомить менеджеров
    const { data: chat } = await supabase
      .from("chats")
      .select("id, customer_name")
      .eq("telegram_id", tgId)
      .single();

    let chatId = chat?.id;

    if (!chatId) {
      const { data: newChat } = await supabase
        .from("chats")
        .insert({
          telegram_id: tgId,
          telegram_username: tgUsername,
          customer_name: firstName,
          status: "open",
          last_message: text,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select("id")
        .single();
      chatId = newChat?.id;
    } else {
      await supabase
        .from("chats")
        .update({
          last_message: text,
          last_message_at: new Date().toISOString(),
          unread_count: supabase.rpc as any,
        })
        .eq("id", chatId);

      await supabase.rpc("increment_unread", { chat_id: chatId });
    }

    if (chatId) {
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_type: "client",
        content: text,
        telegram_message_id: msg.message_id,
      });

      await supabase
        .from("chats")
        .update({ last_message: text, last_message_at: new Date().toISOString() })
        .eq("id", chatId);
    }

    await sendTelegram(
      tgId,
      "✅ Ваше сообщение получено. Менеджер ответит в ближайшее время."
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

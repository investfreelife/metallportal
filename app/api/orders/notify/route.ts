import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

const STATUS_LABELS: Record<string, string> = {
  new:         "🆕 Принят",
  confirmed:   "✅ Подтверждён",
  processing:  "⚙️ В обработке",
  shipped:     "🚚 Отправлен",
  delivered:   "📦 Доставлен",
  cancelled:   "❌ Отменён",
};

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, status, customerPhone, customerName } = await req.json();

    const label = STATUS_LABELS[status] ?? status;
    const message = `
📋 <b>Заказ #${orderId}</b>

Статус: <b>${label}</b>
Клиент: ${customerName ?? "—"}

${status === "shipped" ? "Ваш заказ передан в доставку. Ожидайте звонка менеджера." : ""}
${status === "delivered" ? "Заказ доставлен! Спасибо за покупку 🎉" : ""}
${status === "confirmed" ? "Менеджер подтвердил заказ, скоро свяжемся с вами." : ""}
    `.trim();

    // Найти telegram_id по телефону из profiles
    if (customerPhone) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_id")
        .eq("phone", customerPhone)
        .single();

      if (profile?.telegram_id) {
        await sendTelegram(profile.telegram_id, message);
      }
    }

    // Также проверить по chat (если клиент писал в бот)
    const { data: chat } = await supabase
      .from("chats")
      .select("telegram_id")
      .eq("customer_phone", customerPhone)
      .single();

    if (chat?.telegram_id) {
      await sendTelegram(chat.telegram_id, message);

      // Сохранить системное сообщение в чат
      const { data: chatData } = await supabase
        .from("chats")
        .select("id")
        .eq("telegram_id", chat.telegram_id)
        .single();

      if (chatData) {
        await supabase.from("messages").insert({
          chat_id: chatData.id,
          sender_type: "bot",
          content: `Статус заказа #${orderId} изменён: ${label}`,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

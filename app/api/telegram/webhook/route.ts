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

const CRM_URL = 'https://metallportal-crm2.vercel.app'

async function handleCrmCallback(callbackQuery: {
  id: string
  from: { id: number }
  message?: { message_id: number; chat: { id: number } }
  data?: string
}) {
  const data = callbackQuery.data ?? ''
  if (!data.startsWith('crm_')) return false

  const [, actionRaw, queueId] = data.split('_')
  if (!queueId) return true

  // Map callback action to API action
  const actionMap: Record<string, string> = {
    approve: 'approve',
    reject: 'reject',
    edit: 'approve',    // edit opens CRM — for now treat as approve
    snooze1: 'snooze1',
    snooze3: 'snooze3',
  }
  const action = actionMap[actionRaw]
  if (!action) return true

  // Call CRM API
  await fetch(`${CRM_URL}/api/ai/queue/${queueId}/${action}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {})

  // Answer the callback so Telegram removes the spinner
  const labelMap: Record<string, string> = {
    approve: '✅ Одобрено',
    reject: '❌ Отклонено',
    snooze1: '⏰ Отложено на 1ч',
    snooze3: '⏰ Отложено на 3ч',
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQuery.id,
      text: labelMap[action] ?? 'Готово',
    }),
  }).catch(() => {})

  // Edit message to show status
  if (callbackQuery.message) {
    const statusText = labelMap[action] ?? 'Обработано'
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: { inline_keyboard: [[{ text: statusText, callback_data: 'done' }]] },
      }),
    }).catch(() => {})
  }

  return true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle CRM inline button callbacks
    if (body.callback_query) {
      const handled = await handleCrmCallback(body.callback_query)
      if (handled) return NextResponse.json({ ok: true })
    }

    const msg = body.message;
    if (!msg) return NextResponse.json({ ok: true });

    const tgId: number = msg.from.id;
    const tgUsername: string = msg.from.username ?? "";
    const firstName: string = msg.from.first_name ?? "";
    const text: string = msg.text ?? "";

    // /start — регистрация / приветствие
    if (text.startsWith("/start")) {
      const param = text.split(" ")[1] ?? "";

      // /start mobile_<code> — авторизация мобильного приложения
      if (param.startsWith("mobile_")) {
        const code = param.replace("mobile_", "");
        const { data: authCode } = await supabase
          .from("telegram_auth_codes")
          .select("*")
          .eq("code", code)
          .single();

        if (authCode && !authCode.confirmed && new Date(authCode.expires_at) > new Date()) {
          await supabase.from("telegram_auth_codes").update({
            confirmed: true,
            telegram_id: tgId,
            user_name: firstName,
          }).eq("code", code);

          // Создать профиль если нет
          const syntheticEmail = `tg_${tgId}@telegram.metallportal.app`;
          await supabase.auth.admin.createUser({
            email: syntheticEmail,
            password: `tg_${tgId}_${code.slice(0,8)}`,
            email_confirm: true,
            user_metadata: { full_name: firstName, telegram_id: tgId },
          }).catch(() => {});

          await sendTelegram(tgId,
            `✅ <b>Вход выполнен!</b>\n\nВы вошли в приложение МеталлПортал.\n\nТеперь вы будете получать уведомления о статусах заказов прямо здесь 📱`
          );
        } else {
          await sendTelegram(tgId, "❌ Ссылка недействительна или устарела. Попробуйте войти снова.");
        }
        return NextResponse.json({ ok: true });
      }

      // Обычный /start — приветствие
      const { data: existingChat } = await supabase
        .from("chats").select("id").eq("telegram_id", tgId).single();

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

      await sendTelegram(tgId,
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

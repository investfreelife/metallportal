import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001';
const CRM_URL = 'https://metallportal-crm2.vercel.app';

async function sendTelegram(chatId: number | string, text: string, extra: object = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
}

async function getManagerId(): Promise<string | null> {
  const { data } = await supabase.from('tenant_settings')
    .select('value').eq('tenant_id', TENANT_ID).eq('key', 'CRM_MANAGER_TG_ID').single();
  return data?.value ?? null;
}

async function handleCrmCallback(callbackQuery: {
  id: string
  from: { id: number }
  message?: { message_id: number; chat: { id: number } }
  data?: string
}) {
  const data = callbackQuery.data ?? ''

  // Manager clicked "↩️ Ответить" — enter reply mode
  if (data.startsWith('reply_')) {
    const clientTgId = data.replace('reply_', '')
    await supabase.from('tenant_settings').upsert(
      { tenant_id: TENANT_ID, key: 'manager_reply_to', value: clientTgId, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,key' }
    )
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQuery.id, text: '✏️ Напишите ответ' })
    })
    if (callbackQuery.message?.chat?.id) {
      await sendTelegram(callbackQuery.message.chat.id,
        '✏️ <b>Напишите ответ клиенту</b>\n\nВаше следующее сообщение будет отправлено клиенту.\nДля отмены — /cancel')
    }
    return true
  }

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

    // /status — статус очереди (только менеджер)
    if (text === '/status') {
      const managerId = await getManagerId();
      if (managerId && String(tgId) === String(managerId)) {
        const { count: pending } = await supabase.from('ai_queue')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', TENANT_ID).eq('status', 'pending');
        const { count: contacts } = await supabase.from('contacts')
          .select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
        await sendTelegram(tgId,
          `📊 <b>Статус CRM МеталлПортал</b>\n\n⏳ Ожидают одобрения: <b>${pending ?? 0}</b>\n👥 Контактов в базе: <b>${contacts ?? 0}</b>\n\n🔗 <a href="${CRM_URL}/queue">Открыть очередь</a>`,
          { disable_web_page_preview: true }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // /report — AI отчёт по запросу (только менеджер)
    if (text === '/report') {
      const managerId = await getManagerId();
      if (managerId && String(tgId) === String(managerId)) {
        await sendTelegram(tgId, '⏳ Генерирую AI-отчёт...');
        fetch(`${CRM_URL}/api/monitor/report`, { method: 'POST' }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // /queue — список задач (только менеджер)
    if (text === '/queue') {
      const managerId = await getManagerId();
      if (managerId && String(tgId) === String(managerId)) {
        const { data: items } = await supabase.from('ai_queue')
          .select('id, action_type, priority, contacts(full_name, phone)')
          .eq('tenant_id', TENANT_ID).eq('status', 'pending')
          .order('priority').limit(5);
        if (!items?.length) {
          await sendTelegram(tgId, '✅ Очередь пуста!');
        } else {
          const lines = items.map((it, i) => {
            const c = it.contacts as { full_name?: string; phone?: string } | null;
            const who = (c as Record<string, string>)?.full_name || (c as Record<string, string>)?.phone || 'Неизвестен';
            const prio = it.priority === 'high' ? '🔴' : it.priority === 'medium' ? '🟡' : '🟢';
            return `${i + 1}. ${prio} ${it.action_type} — ${who}`;
          }).join('\n');
          await sendTelegram(tgId,
            `📋 <b>Очередь (${items.length}):</b>\n\n${lines}\n\n🔗 <a href="${CRM_URL}/queue">Открыть все</a>`,
            { disable_web_page_preview: true }
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    // /start — регистрация / приветствие
    if (text.startsWith("/start")) {
      const param = text.split(" ")[1] ?? "";

      // /start manager_TOKEN — привязать менеджера к CRM
      if (param.startsWith("manager_")) {
        const linkToken = param.replace("manager_", "");
        const { data: stored } = await supabase.from('tenant_settings')
          .select('value').eq('tenant_id', TENANT_ID).eq('key', '_manager_link_token').single();
        const [storedToken, expiresAt] = (stored?.value ?? '').split('|');
        if (!storedToken || storedToken !== linkToken || new Date(expiresAt) < new Date()) {
          await sendTelegram(tgId, '❌ Ссылка недействительна или истекла. Сгенерируйте новую в CRM → Настройки → Telegram.');
        } else {
          await supabase.from('tenant_settings').upsert(
            { tenant_id: TENANT_ID, key: 'CRM_MANAGER_TG_ID', value: String(tgId), updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id,key' }
          );
          await supabase.from('tenant_settings').upsert(
            { tenant_id: TENANT_ID, key: '_manager_link_token', value: '', updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id,key' }
          );
          await sendTelegram(tgId,
            `✅ <b>Telegram подключён к CRM МеталлПортал!</b>\n\n👤 ${firstName}\n🆔 Ваш Chat ID: <code>${tgId}</code>\n\nТеперь новые лиды и заявки приходят сюда с кнопками одобрения.\n\nКоманды:\n/status — статус очереди\n/queue — список задач\n\n🔗 <a href="${CRM_URL}">Открыть CRM</a>`,
            { disable_web_page_preview: true }
          );
        }
        return NextResponse.json({ ok: true });
      }

      // /start client_PHONE — клиент подписывается на ответы
      if (param.startsWith("client_")) {
        const phoneDigits = param.replace("client_", "")
        const normalizedPhone = phoneDigits.length === 11
          ? '+' + phoneDigits
          : phoneDigits.length === 10
          ? '+7' + phoneDigits
          : '+' + phoneDigits

        // Найти контакт по телефону и сохранить chat_id
        const { data: contact } = await supabase.from('contacts')
          .select('id, full_name, phone')
          .eq('tenant_id', TENANT_ID)
          .eq('phone', normalizedPhone)
          .single()

        if (contact) {
          await supabase.from('contacts')
            .update({ telegram_chat_id: String(tgId), updated_at: new Date().toISOString() })
            .eq('id', contact.id)
          await sendTelegram(tgId,
            `✅ <b>Отлично, ${firstName || contact.full_name || 'друг'}!</b>\n\nТеперь вы будете получать ответы менеджера прямо здесь.\n\nМы рассмотрим вашу заявку и напишем в ближайшие 15 минут 💬`
          )
        } else {
          // Создать новый контакт с telegram_chat_id
          await supabase.from('contacts').insert({
            tenant_id: TENANT_ID,
            full_name: firstName || null,
            phone: normalizedPhone,
            telegram_chat_id: String(tgId),
            source: 'telegram',
            ai_score: 5,
          })
          await sendTelegram(tgId,
            `👋 Привет, <b>${firstName}!</b>\n\nМы записали вас как нового клиента МеталлПортал.\nМенеджер свяжется с вами в ближайшее время 💬`
          )
        }
        return NextResponse.json({ ok: true })
      }

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

    // Если пишет менеджер — пересылаем клиенту или игнорируем
    const managerId = await getManagerId()
    if (managerId && String(tgId) === String(managerId)) {
      if (text === '/cancel') {
        await supabase.from('tenant_settings').upsert(
          { tenant_id: TENANT_ID, key: 'manager_reply_to', value: null, updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id,key' }
        )
        await sendTelegram(tgId, '❌ Ответ отменён.')
      } else {
        const { data: replyTo } = await supabase.from('tenant_settings')
          .select('value').eq('tenant_id', TENANT_ID).eq('key', 'manager_reply_to').single()
        if (replyTo?.value) {
          // Отправить клиенту
          await sendTelegram(replyTo.value, `📩 <b>Менеджер МеталлПортал:</b>\n\n${text}`)
          // Сохранить в messages
          const { data: clientChat } = await supabase.from('chats')
            .select('id').eq('telegram_id', replyTo.value).single()
          if (clientChat) {
            await supabase.from('messages').insert({ chat_id: clientChat.id, sender_type: 'manager', content: text })
            await supabase.from('chats').update({ last_message: `Менеджер: ${text}`, last_message_at: new Date().toISOString() }).eq('id', clientChat.id)
          }
          // Очистить режим ответа
          await supabase.from('tenant_settings').upsert(
            { tenant_id: TENANT_ID, key: 'manager_reply_to', value: null, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id,key' }
          )
          await sendTelegram(tgId, '✅ Ответ отправлен клиенту!')
        } else {
          await sendTelegram(tgId, '⚠️ Режим ответа не активен.\nНажмите «↩️ Ответить» в уведомлении о сообщении клиента.')
        }
      }
      return NextResponse.json({ ok: true })
    }

    // Обычное сообщение от клиента — сохранить и уведомить менеджеров
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
      await supabase.from('chats').update({
        last_message: text,
        last_message_at: new Date().toISOString(),
      }).eq('id', chatId);
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

    // Уведомить менеджера о новом сообщении от клиента
    if (managerId) {
      const clientName = chat?.customer_name || firstName || 'Клиент';
      await sendTelegram(managerId,
        `💬 <b>Новое сообщение от клиента</b>\n\n👤 ${clientName}\n📞 TG ID: <code>${tgId}</code>\n\n� ${text}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Ответить', callback_data: `reply_${tgId}` },
              { text: '💬 Открыть CRM', url: 'https://metallportal-crm2.vercel.app/chats' }
            ]]
          }
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * CRM Telegram notifications — sends AI queue items to manager with approval buttons.
 *
 * Env vars needed:
 *   TELEGRAM_BOT_TOKEN     — same bot as main site
 *   CRM_MANAGER_TG_ID      — manager's personal Telegram chat_id (get via @userinfobot)
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const MANAGER_TG_ID = process.env.CRM_MANAGER_TG_ID

const PRIORITY_EMOJI: Record<string, string> = {
  high:   '🔴',
  medium: '🟡',
  low:    '🟢',
}

const ACTION_LABEL: Record<string, string> = {
  call:           '📞 Позвонить',
  send_proposal:  '📄 Отправить КП',
  send_message:   '💬 Написать',
  schedule:       '📅 Запланировать',
}

export interface NotifyPayload {
  queue_id: string
  contact_name?: string | null
  contact_phone?: string | null
  action_type: string
  priority: string
  ai_reasoning: string
  suggested_message: string
}

export async function notifyManager(payload: NotifyPayload): Promise<boolean> {
  if (!BOT_TOKEN || !MANAGER_TG_ID) return false

  const emoji = PRIORITY_EMOJI[payload.priority] ?? '⚪'
  const action = ACTION_LABEL[payload.action_type] ?? payload.action_type

  const contact = [
    payload.contact_name,
    payload.contact_phone,
  ].filter(Boolean).join(' · ') || 'Новый контакт'

  const text = [
    `${emoji} <b>Новое действие ИИ</b>`,
    '',
    `<b>Контакт:</b> ${contact}`,
    `<b>Действие:</b> ${action}`,
    '',
    `<b>Почему:</b> ${payload.ai_reasoning}`,
    '',
    `<b>Предлагаемый текст:</b>`,
    `<i>${payload.suggested_message}</i>`,
  ].join('\n')

  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Одобрить', callback_data: `crm_approve_${payload.queue_id}` },
      { text: '✏️ Изменить', callback_data: `crm_edit_${payload.queue_id}` },
      { text: '❌ Отклонить', callback_data: `crm_reject_${payload.queue_id}` },
    ], [
      { text: '⏰ Напомни через 1ч', callback_data: `crm_snooze1_${payload.queue_id}` },
      { text: '📋 Открыть в CRM', url: `https://metallportal-crm2.vercel.app/queue` },
    ]],
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: MANAGER_TG_ID,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {})
}

export async function editMessageText(chatId: number | string, messageId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }),
  }).catch(() => {})
}

/**
 * Telegram Bot integration (m008 placeholder).
 *
 * Auth: webhook-style. Bot token уже стоит в env `TELEGRAM_BOT_TOKEN`
 * (m001 + ref-tracker). Connect-flow:
 *  1. Admin вводит bot username в UI (e.g. @harlanmetall_bot).
 *  2. POST к Telegram API setWebhook → /api/integrations/telegram_bot/webhook.
 *  3. Если 200 OK → status='connected', metadata.username = '@harlanmetall_bot'.
 *
 * m008 заполнит:
 *  - sendNotification()   — leads notification в private chat owner'a
 *  - publishToChannel()   — авто-пост в paid Telegram-channel компании
 *  - handleIncoming()     — webhook handler для commands от users
 */

export const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

// TODO m008 — implement. m001 уже имеет ref-tracker через bot, можно reuse.

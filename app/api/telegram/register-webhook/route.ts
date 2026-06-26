import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/telegram/register-webhook
 *
 * Регистрирует webhook в Telegram BotAPI. Передаёт `secret_token` из env
 * (TASK_052 hardening) — обязательно вместе с проверкой в /api/telegram/webhook.
 *
 * Защищено requireAdmin: смена URL вебхука = админ-операция, не публичный
 * bootstrap (раньше был GET без auth — каждый посетитель мог пересоздать
 * вебхук на свой URL).
 */
export async function GET(_req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.error;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан" }, { status: 500 });
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://metallportal.vercel.app';
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const params = new URLSearchParams({ url: webhookUrl });
  if (secret) params.set("secret_token", secret);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`
  );
  const data = await res.json();
  return NextResponse.json({
    ...data,
    _meta: {
      webhook_url: webhookUrl,
      secret_set: !!secret,
      warning: secret ? null : "TELEGRAM_WEBHOOK_SECRET не задан в env — вебхук НЕ защищён, любой подделает callbacks. Задай ≥32-char random в Vercel env и пересоздай вебхук.",
    },
  });
}

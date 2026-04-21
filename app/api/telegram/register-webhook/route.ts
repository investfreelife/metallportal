import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metallportal.ru";
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
  );
  const data = await res.json();
  return NextResponse.json(data);
}

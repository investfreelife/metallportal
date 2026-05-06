import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getIntegrationsClient } from "@/lib/integrations/_base";
import { isValidProvider, getProviderMeta } from "@/lib/integrations/_providers";
import type { IntegrationProviderSlug } from "@/lib/integrations/_base";
import { SITE_URL } from "@/lib/site";

/**
 * GET /api/integrations/[provider]/connect
 *
 * Запускает OAuth flow для provider:
 *  1. Generates random state token (CSRF protection).
 *  2. Сохраняет state в `integration_oauth_states` table (TTL 10 мин).
 *  3. Redirect к provider's authorize URL с client_id + redirect_uri + state.
 *
 * Provider-specific behavior:
 *  - oauth2 → стандартный redirect к oauthAuthorizeUrl с params.
 *  - token / webhook → returns 400 «not implemented for this auth method»
 *    (UI должен использовать другой flow — manual token-paste).
 *  - service-account → returns 400 «provider configured via env vars».
 *
 * **TODO m007 / m008**: добавить per-provider client_id из env
 * (YANDEX_OAUTH_CLIENT_ID, VK_APP_ID и т.д.). Сейчас если client_id
 * не задан — возвращаем placeholder URL для testing UI flow.
 */

export const runtime = "nodejs";

const OAUTH_STATE_TTL_MIN = 10;

export async function GET(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  if (!isValidProvider(params.provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const provider = params.provider as IntegrationProviderSlug;
  const meta = getProviderMeta(provider);

  if (meta.authMethod === "service-account") {
    return NextResponse.json(
      {
        error:
          "Provider configured via env vars; no OAuth flow. См. Vercel env settings.",
      },
      { status: 400 },
    );
  }

  if (meta.authMethod === "webhook") {
    return NextResponse.json(
      {
        error:
          "Webhook-based provider (e.g. Telegram Bot) — connection через manual webhook setup, не OAuth redirect.",
      },
      { status: 400 },
    );
  }

  if (meta.authMethod === "token") {
    return NextResponse.json(
      {
        error:
          "Token-based provider — manual API token paste через provider settings page.",
      },
      { status: 400 },
    );
  }

  // OAuth2 flow.
  if (!meta.oauthAuthorizeUrl) {
    return NextResponse.json(
      { error: "Provider misconfigured: missing oauthAuthorizeUrl" },
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + OAUTH_STATE_TTL_MIN * 60 * 1000,
  ).toISOString();

  const supabase = getIntegrationsClient();
  const { error: insertErr } = await supabase
    .from("integration_oauth_states")
    .insert({ state, provider, expires_at: expiresAt });

  if (insertErr) {
    return NextResponse.json(
      { error: `Failed to persist OAuth state: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // Build authorize URL.
  // client_id из env per provider — TODO m007/m008 для каждого. Пока fallback
  // на placeholder; UI получит redirect к provider's error page если client_id
  // не настроен — это OK для phase 1 (admin увидит warning).
  const envKeyMap: Record<string, string | undefined> = {
    yandex_direct: process.env.YANDEX_OAUTH_CLIENT_ID,
    yandex_metrika: process.env.YANDEX_OAUTH_CLIENT_ID,
    yandex_zen: process.env.YANDEX_OAUTH_CLIENT_ID,
    vk: process.env.VK_OAUTH_CLIENT_ID,
  };
  const clientId = envKeyMap[provider] ?? "PLACEHOLDER_CLIENT_ID_NOT_SET";
  const redirectUri = `${SITE_URL}/api/integrations/${provider}/callback`;

  const authorizeUrl = new URL(meta.oauthAuthorizeUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  if (meta.oauthScopes?.length) {
    authorizeUrl.searchParams.set("scope", meta.oauthScopes.join(" "));
  }

  return NextResponse.redirect(authorizeUrl.toString(), { status: 302 });
}

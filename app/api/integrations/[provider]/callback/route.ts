import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsClient } from "@/lib/integrations/_base";
import { isValidProvider, getProviderMeta } from "@/lib/integrations/_providers";
import { encryptToken } from "@/lib/integrations/_encryption";
import type { IntegrationProviderSlug } from "@/lib/integrations/_base";
import { SITE_URL } from "@/lib/site";

/**
 * GET /api/integrations/[provider]/callback?code=...&state=...
 *
 * OAuth2 callback handler:
 *  1. Validate state (CSRF) против `integration_oauth_states`.
 *  2. Exchange code → access_token + refresh_token (POST к provider's tokenUrl).
 *  3. Encrypt tokens → INSERT/UPDATE row в `integrations` (status='connected').
 *  4. Cleanup state row.
 *  5. Redirect к /admin/integrations?provider={slug}&result=connected.
 *
 * Error redirects идут с `?result=error&reason=...`.
 *
 * **TODO m007**: для каждого provider нужен env CLIENT_SECRET (Yandex_OAUTH_
 * CLIENT_SECRET, etc.) и actual token-exchange POST. Сейчас если secret не
 * настроен — возвращаем error redirect.
 */

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } },
) {
  if (!isValidProvider(params.provider)) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?result=error&reason=unknown_provider`,
      { status: 302 },
    );
  }
  const provider = params.provider as IntegrationProviderSlug;
  const meta = getProviderMeta(provider);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  // Provider returned error (user cancelled / denied / etc.)
  if (errParam) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=${encodeURIComponent(errParam)}`,
      { status: 302 },
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=missing_code_or_state`,
      { status: 302 },
    );
  }

  const supabase = getIntegrationsClient();

  // 1. Validate state (CSRF).
  const { data: stateRow, error: stateErr } = await supabase
    .from("integration_oauth_states")
    .select("provider, user_id, expires_at")
    .eq("state", state)
    .maybeSingle();

  if (stateErr || !stateRow) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=invalid_state`,
      { status: 302 },
    );
  }
  if (stateRow.provider !== provider) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=provider_mismatch`,
      { status: 302 },
    );
  }
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=state_expired`,
      { status: 302 },
    );
  }

  // 2. Exchange code → tokens.
  if (!meta.oauthTokenUrl) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=no_token_url`,
      { status: 302 },
    );
  }

  const envClientIdMap: Record<string, string | undefined> = {
    yandex_direct: process.env.YANDEX_OAUTH_CLIENT_ID,
    yandex_metrika: process.env.YANDEX_OAUTH_CLIENT_ID,
    yandex_zen: process.env.YANDEX_OAUTH_CLIENT_ID,
    vk: process.env.VK_OAUTH_CLIENT_ID,
  };
  const envClientSecretMap: Record<string, string | undefined> = {
    yandex_direct: process.env.YANDEX_OAUTH_CLIENT_SECRET,
    yandex_metrika: process.env.YANDEX_OAUTH_CLIENT_SECRET,
    yandex_zen: process.env.YANDEX_OAUTH_CLIENT_SECRET,
    vk: process.env.VK_OAUTH_CLIENT_SECRET,
  };
  const clientId = envClientIdMap[provider];
  const clientSecret = envClientSecretMap[provider];

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=client_credentials_not_configured`,
      { status: 302 },
    );
  }

  const redirectUri = `${SITE_URL}/api/integrations/${provider}/callback`;

  let tokenResponse: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };
  try {
    const res = await fetch(meta.oauthTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });
    tokenResponse = await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=${encodeURIComponent("token_exchange_failed: " + msg)}`,
      { status: 302 },
    );
  }

  if (!tokenResponse.access_token) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=${encodeURIComponent("no_access_token: " + (tokenResponse.error ?? "unknown"))}`,
      { status: 302 },
    );
  }

  // 3. Encrypt + UPSERT.
  const accessEnc = await encryptToken(tokenResponse.access_token);
  const refreshEnc = tokenResponse.refresh_token
    ? await encryptToken(tokenResponse.refresh_token)
    : null;
  const expiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
    : null;

  const { error: upsertErr } = await supabase.from("integrations").upsert(
    {
      provider,
      status: "connected",
      access_token_encrypted: accessEnc,
      refresh_token_encrypted: refreshEnc,
      expires_at: expiresAt,
      scopes: tokenResponse.scope?.split(" ") ?? meta.oauthScopes ?? null,
      connected_by: stateRow.user_id,
      connected_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
      metadata: {},
    },
    { onConflict: "provider,connected_by" },
  );

  if (upsertErr) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/integrations?provider=${provider}&result=error&reason=${encodeURIComponent("upsert_failed: " + upsertErr.message)}`,
      { status: 302 },
    );
  }

  // 4. Cleanup state row (one-time use).
  await supabase.from("integration_oauth_states").delete().eq("state", state);

  // 5. Success redirect.
  return NextResponse.redirect(
    `${SITE_URL}/admin/integrations?provider=${provider}&result=connected`,
    { status: 302 },
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsClient } from "@/lib/integrations/_base";
import { isValidProvider, getProviderMeta } from "@/lib/integrations/_providers";
import { encryptToken, decryptToken } from "@/lib/integrations/_encryption";
import type { IntegrationProviderSlug } from "@/lib/integrations/_base";

/**
 * POST /api/integrations/[provider]/refresh
 *
 * Refresh access_token используя сохранённый refresh_token. Логика:
 *  1. Read row из integrations (status='connected' или 'expired').
 *  2. Decrypt refresh_token.
 *  3. POST к provider's tokenUrl с grant_type=refresh_token.
 *  4. Encrypt new access_token (+ refresh, если provider rotates) → UPDATE.
 *
 * Если refresh fails (token revoked / expired refresh) — set status='expired'
 * + last_error, возвращаем 401 чтобы UI показал «Reconnect required».
 *
 * **TODO m007**: каждый provider тестирует по-разному (Yandex принимает
 * refresh без secret, VK — с secret). Сейчас базовый POST с client_secret
 * (если задан) — works для большинства OAuth2 providers.
 */

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  if (!isValidProvider(params.provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const provider = params.provider as IntegrationProviderSlug;
  const meta = getProviderMeta(provider);

  if (meta.authMethod !== "oauth2" || !meta.oauthTokenUrl) {
    return NextResponse.json(
      { error: "Provider does not support refresh (non-OAuth2)" },
      { status: 400 },
    );
  }

  const supabase = getIntegrationsClient();
  const { data: row, error: readErr } = await supabase
    .from("integrations")
    .select("id, refresh_token_encrypted")
    .eq("provider", provider)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readErr || !row) {
    return NextResponse.json(
      { error: "No integration row found — connect first" },
      { status: 404 },
    );
  }
  if (!row.refresh_token_encrypted) {
    return NextResponse.json(
      { error: "No refresh_token saved — full reconnect required" },
      { status: 401 },
    );
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptToken(row.refresh_token_encrypted);
  } catch (err) {
    return NextResponse.json(
      { error: `Decrypt failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
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
    return NextResponse.json(
      { error: "Provider client_id/secret not configured" },
      { status: 500 },
    );
  }

  let tokenResponse: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  try {
    const res = await fetch(meta.oauthTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    tokenResponse = await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    await supabase
      .from("integrations")
      .update({
        status: "error",
        last_error: `refresh_fetch_failed: ${msg}`,
        last_error_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!tokenResponse.access_token) {
    const errMsg = tokenResponse.error ?? "no_access_token";
    await supabase
      .from("integrations")
      .update({
        status: "expired",
        last_error: errMsg,
        last_error_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return NextResponse.json(
      { error: `Refresh failed: ${errMsg}. Reconnect required.` },
      { status: 401 },
    );
  }

  const accessEnc = await encryptToken(tokenResponse.access_token);
  const newRefreshEnc = tokenResponse.refresh_token
    ? await encryptToken(tokenResponse.refresh_token)
    : row.refresh_token_encrypted; // keep old refresh если provider не rotates

  const expiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
    : null;

  const { error: updateErr } = await supabase
    .from("integrations")
    .update({
      status: "connected",
      access_token_encrypted: accessEnc,
      refresh_token_encrypted: newRefreshEnc,
      expires_at: expiresAt,
      last_used_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    })
    .eq("id", row.id);

  if (updateErr) {
    return NextResponse.json(
      { error: `DB update failed: ${updateErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    expires_at: expiresAt,
  });
}

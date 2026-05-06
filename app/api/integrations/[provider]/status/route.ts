import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsClient } from "@/lib/integrations/_base";
import { isValidProvider, getProviderMeta } from "@/lib/integrations/_providers";
import { getVoximplantStatus } from "@/lib/integrations/voximplant";
import type { IntegrationProviderSlug } from "@/lib/integrations/_base";

/**
 * GET /api/integrations/[provider]/status
 *
 * Возвращает текущий status integration. Используется admin UI для polling
 * после connect-button click (UI рендерит статус из этого endpoint каждые
 * 5 сек пока status === 'pending').
 *
 * Response shape:
 *   {
 *     provider: 'yandex_direct',
 *     displayName: 'Яндекс.Директ',
 *     status: 'pending' | 'connected' | 'expired' | 'revoked' | 'error' | 'not_configured',
 *     metadata: {...},
 *     last_error: string | null,
 *     expires_at: string | null,
 *     connected_at: string | null,
 *   }
 *
 * Auth: AdminGuard на UI. Endpoint без auth check — protected на network level
 * через RLS (только service_role bypass'ит). Production: добавить middleware
 * check для admin role (TBD m007 hardening).
 */

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  if (!isValidProvider(params.provider)) {
    return NextResponse.json(
      { error: "Unknown provider" },
      { status: 404 },
    );
  }
  const provider = params.provider as IntegrationProviderSlug;
  const meta = getProviderMeta(provider);

  // Voximplant — special case. Status read'ится из env, не из БД.
  if (provider === "voximplant") {
    const vox = getVoximplantStatus();
    return NextResponse.json({
      provider,
      displayName: meta.displayName,
      status: vox.configured ? "connected" : "not_configured",
      metadata: {
        accountId: vox.accountId,
        email: vox.email,
        hasPrivateKey: vox.hasPrivateKey,
      },
      last_error: null,
      expires_at: null,
      connected_at: null,
    });
  }

  // Все остальные — read из integrations table.
  const supabase = getIntegrationsClient();
  const { data, error } = await supabase
    .from("integrations")
    .select(
      "id, status, expires_at, scopes, metadata, connected_at, last_used_at, last_error, last_error_at",
    )
    .eq("provider", provider)
    // Берём latest connected (или единственный — UNIQUE по (provider, connected_by)).
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `DB error: ${error.message}` },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({
      provider,
      displayName: meta.displayName,
      status: "not_configured",
      metadata: {},
      last_error: null,
      expires_at: null,
      connected_at: null,
    });
  }

  return NextResponse.json({
    provider,
    displayName: meta.displayName,
    status: data.status,
    metadata: data.metadata,
    last_error: data.last_error,
    last_error_at: data.last_error_at,
    expires_at: data.expires_at,
    connected_at: data.connected_at,
    last_used_at: data.last_used_at,
    scopes: data.scopes,
  });
}

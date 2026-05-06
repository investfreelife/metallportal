import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsClient } from "@/lib/integrations/_base";
import { isValidProvider } from "@/lib/integrations/_providers";
import type { IntegrationProviderSlug } from "@/lib/integrations/_base";

/**
 * POST /api/integrations/[provider]/disconnect
 *
 * Удаляет integration row для given provider. Token revocation на стороне
 * provider (Yandex/VK) — TBD per-provider helper в m007/m008. Сейчас
 * полагается на TTL access_token + manual user revocation если потребуется.
 *
 * Body: пустое.
 * Response: { ok: true } или { error }.
 *
 * **Note**: для Voximplant disconnect через UI неприменим (env-based) —
 * возвращаем 400.
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

  if (provider === "voximplant") {
    return NextResponse.json(
      {
        error:
          "Voximplant configured via env vars. Удалите/измените значения в Vercel env.",
      },
      { status: 400 },
    );
  }

  const supabase = getIntegrationsClient();
  const { error, count } = await supabase
    .from("integrations")
    .delete({ count: "exact" })
    .eq("provider", provider);

  if (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}

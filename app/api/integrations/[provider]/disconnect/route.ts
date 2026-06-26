import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsClient } from "@/lib/integrations/_base";
import { isValidProvider } from "@/lib/integrations/_providers";
import type { IntegrationProviderSlug } from "@/lib/integrations/_base";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/integrations/[provider]/disconnect
 *
 * TASK_052 hardening (audit 2026-06-18 SEV-1):
 * Раньше без auth — любой запрос удалял integration row по provider, без
 * проверки владельца (UNIQUE(provider, connected_by) — у одного юзера одна
 * интеграция на провайдер, но row может быть и чужой). Атака: drop OAuth
 * у другого юзера.
 *
 * Теперь: требует залогиненного user + удаляет ТОЛЬКО `eq('connected_by', user.id)`.
 *
 * Body: пустое. Response: { ok: true, deleted } или { error }.
 *
 * **Note**: для Voximplant disconnect через UI неприменим (env-based) — 400.
 */

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  // SEV-1 fix: owner-scoped delete — нельзя дропнуть чужую интеграцию.
  const { error, count } = await supabase
    .from("integrations")
    .delete({ count: "exact" })
    .eq("provider", provider)
    .eq("connected_by", user.id);

  if (error) {
    console.error("[integrations/disconnect] error:", error.message);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}

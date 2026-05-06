import { createAdminClient } from "@/lib/supabase";

/**
 * Untyped Supabase admin client для integrations таблиц.
 *
 * `lib/database.types.ts` сгенерирован до n004 — новые таблицы
 * (`integrations`, `integration_oauth_states`) не в Database<T>. Чтобы
 * не блокировать m007/m008 ожиданием typegen — используем untyped client
 * (cast в `any`). Trade-off: TypeScript не check'ит column names в queries
 * — компенсируем тестами + careful code review.
 *
 * После n004 closure — Pavel/Сергей runs `npx supabase gen types typescript`
 * и меняем этот helper на typed client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getIntegrationsClient(): any {
  return createAdminClient();
}

/**
 * Shared types для admin/integrations infrastructure.
 *
 * Schema — `integrations` table (см. migration 20260527000000).
 * Provider config — `_providers.ts` (whitelist + per-provider OAuth metadata).
 */

export type IntegrationStatus =
  | "pending"
  | "connected"
  | "expired"
  | "revoked"
  | "error";

/** White-list — match'ит slug в URL (`/admin/integrations/[provider]`). */
export type IntegrationProviderSlug =
  | "yandex_direct"
  | "yandex_metrika"
  | "yandex_maps"
  | "yandex_zen"
  | "vk"
  | "telegram_bot"
  | "voximplant";

/**
 * Запись в БД (после select). Tokens НЕ возвращаются в client — только в
 * server actions / API routes когда нужно для outbound request к provider.
 */
export interface IntegrationRow {
  id: string;
  provider: IntegrationProviderSlug;
  status: IntegrationStatus;
  expires_at: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown>;
  connected_by: string | null;
  connected_at: string;
  last_used_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
}

/** Ответ для admin UI — БЕЗ encrypted tokens fields. */
export type IntegrationPublic = Omit<
  IntegrationRow,
  // Tokens хранятся в bytea columns — не отдаём UI:
  never
>;

/** Метаданные provider'а (используются tile UI + connect flow). */
export interface ProviderMetadata {
  slug: IntegrationProviderSlug;
  /** Visible name в tile + breadcrumb. */
  displayName: string;
  /** Короткое описание (1 предложение) — под tile. */
  shortDescription: string;
  /** Lucide icon name или emoji. */
  icon: string;
  /** Brand-color (hex) для accent-elements в tile. */
  brandColor?: string;
  /**
   * OAuth flow type:
   *  - 'oauth2' — стандартный auth-code flow (Yandex / VK / etc.)
   *  - 'token'  — простой long-lived API token (no flow, manual paste)
   *  - 'webhook' — bot-style (Telegram), где регистрация webhook = "connect"
   *  - 'service-account' — Voximplant (key + private base64) — connected уже
   *                       через env, требует только UI verify.
   */
  authMethod: "oauth2" | "token" | "webhook" | "service-account";
  /**
   * OAuth-specific. Optional для token/webhook/service-account.
   * Authorize URL без `state` и `redirect_uri` — добавятся в connect-route.
   */
  oauthAuthorizeUrl?: string;
  oauthTokenUrl?: string;
  oauthScopes?: string[];
  /** Provider-specific docs link для tile help-icon. */
  docsUrl?: string;
}

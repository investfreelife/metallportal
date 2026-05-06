import type { IntegrationProviderSlug, ProviderMetadata } from "./_base";

/**
 * Provider registry. Используется:
 *  - `/admin/integrations` page renders tiles per provider в этом порядке.
 *  - API routes `/api/integrations/[provider]/*` validates slug против `PROVIDER_SLUGS`.
 *  - m007 (Yandex stack) и m008 (social channels) дополняют specific clients
 *    в `lib/integrations/{provider}.ts`.
 *
 * Order — порядок отображения в admin UI (visual important first).
 */

export const PROVIDERS: Record<IntegrationProviderSlug, ProviderMetadata> = {
  // ─── Yandex stack (m007) ──────────────────────────────────────────
  yandex_direct: {
    slug: "yandex_direct",
    displayName: "Яндекс.Директ",
    shortDescription:
      "Контекстная реклама. Управление кампаниями, статистика, авто-стратегии.",
    icon: "📊",
    brandColor: "#FFCC00",
    authMethod: "oauth2",
    oauthAuthorizeUrl: "https://oauth.yandex.ru/authorize",
    oauthTokenUrl: "https://oauth.yandex.ru/token",
    oauthScopes: ["direct:api"],
    docsUrl: "https://yandex.ru/dev/direct/doc/dg/concepts/about.html",
  },
  yandex_metrika: {
    slug: "yandex_metrika",
    displayName: "Яндекс.Метрика",
    shortDescription:
      "Аналитика трафика. Цели, конверсии, источники, поведение пользователей.",
    icon: "📈",
    brandColor: "#FFCC00",
    authMethod: "oauth2",
    oauthAuthorizeUrl: "https://oauth.yandex.ru/authorize",
    oauthTokenUrl: "https://oauth.yandex.ru/token",
    oauthScopes: ["metrika:read", "metrika:write"],
    docsUrl: "https://yandex.ru/dev/metrika/doc/api2/concept/about.html",
  },
  yandex_maps: {
    slug: "yandex_maps",
    displayName: "Яндекс.Карты / Справочник",
    shortDescription:
      "Бизнес-карточка в Я.Картах + Я.Справочник. NAP, отзывы, фото.",
    icon: "🗺️",
    brandColor: "#FFCC00",
    authMethod: "token",
    docsUrl: "https://yandex.ru/sprav/",
  },
  yandex_zen: {
    slug: "yandex_zen",
    displayName: "Яндекс.Дзен",
    shortDescription:
      "Публикация статей в Дзен. Интеграция с Юлиными content-batch'ами.",
    icon: "📰",
    brandColor: "#FFCC00",
    authMethod: "oauth2",
    oauthAuthorizeUrl: "https://oauth.yandex.ru/authorize",
    oauthTokenUrl: "https://oauth.yandex.ru/token",
    oauthScopes: ["zen:publish"],
    docsUrl: "https://yandex.ru/dev/dzen/doc/ru/",
  },

  // ─── Social (m008) ─────────────────────────────────────────────────
  vk: {
    slug: "vk",
    displayName: "ВКонтакте",
    shortDescription:
      "Группа компании, авто-постинг новых landings/articles, отзывы.",
    icon: "🔵",
    brandColor: "#4C75A3",
    authMethod: "oauth2",
    oauthAuthorizeUrl: "https://oauth.vk.com/authorize",
    oauthTokenUrl: "https://oauth.vk.com/access_token",
    oauthScopes: ["wall", "groups", "photos"],
    docsUrl: "https://dev.vk.com/api/oauth-parameters",
  },
  telegram_bot: {
    slug: "telegram_bot",
    displayName: "Telegram Bot",
    shortDescription:
      "Канал @harlanmetall_bot для уведомлений лидам + paid-channel постинг.",
    icon: "✈️",
    brandColor: "#229ED9",
    authMethod: "webhook",
    docsUrl: "https://core.telegram.org/bots/api",
  },

  // ─── Other infrastructure ──────────────────────────────────────────
  voximplant: {
    slug: "voximplant",
    displayName: "Voximplant CPaaS",
    shortDescription:
      "Виртуальный номер +7 (499) 325-39-69. Переадресация на мобильный, IVR.",
    icon: "📞",
    brandColor: "#1FAEE9",
    authMethod: "service-account",
    docsUrl: "https://voximplant.com/docs",
  },
};

/** Order для render'а tiles в admin UI. */
export const PROVIDER_ORDER: IntegrationProviderSlug[] = [
  "yandex_direct",
  "yandex_metrika",
  "yandex_maps",
  "yandex_zen",
  "vk",
  "telegram_bot",
  "voximplant",
];

/** Validation для API routes: `params.provider` is one of these. */
export function isValidProvider(slug: string): slug is IntegrationProviderSlug {
  return slug in PROVIDERS;
}

export function getProviderMeta(
  slug: IntegrationProviderSlug,
): ProviderMetadata {
  return PROVIDERS[slug];
}

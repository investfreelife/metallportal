/**
 * Yandex stack provider client (placeholder для m007).
 *
 * 4 sub-providers: yandex_direct, yandex_metrika, yandex_maps, yandex_zen.
 * Все используют общий Yandex OAuth (oauth.yandex.ru) — отличаются только
 * scopes. m007 заполнит:
 *  - getDirectCampaigns()  — список campaigns + CTR/cost
 *  - getMetrikaSummary()  — visits / goals / sources за период
 *  - syncMapsListing()    — обновление NAP / фото / отзывы из админки
 *  - publishZenArticle()  — публикация Юлиных статей через Zen API
 *
 * Authentication: OAuth2 access_token + refresh_token, encrypted в БД
 * (см. _encryption.ts). Refresh — отдельный route POST
 * /api/integrations/yandex_{sub}/refresh.
 */

export const YANDEX_OAUTH_AUTHORIZE = "https://oauth.yandex.ru/authorize";
export const YANDEX_OAUTH_TOKEN = "https://oauth.yandex.ru/token";

// TODO m007 — implement actual API clients per sub-service.

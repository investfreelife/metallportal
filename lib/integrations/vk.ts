/**
 * VK provider client (placeholder для m008).
 *
 * Auth: OAuth2 implicit/code flow → access_token (long-lived). Scopes:
 *  - wall — пост в группе
 *  - groups — list / админка групп
 *  - photos — upload фото к посту
 *
 * m008 заполнит:
 *  - listCommunities()    — выбор группы для авто-постинга в admin UI
 *  - postToWall()         — авто-пост новой landing / article
 *  - replyToComment()     — реакция на комменты (с ИИ-агентом)
 */

export const VK_OAUTH_AUTHORIZE = "https://oauth.vk.com/authorize";
export const VK_OAUTH_TOKEN = "https://oauth.vk.com/access_token";
export const VK_API_BASE = "https://api.vk.com/method";
export const VK_API_VERSION = "5.199";

// TODO m008 — implement.

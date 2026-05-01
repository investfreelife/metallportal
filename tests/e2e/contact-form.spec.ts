import { test, expect } from '@playwright/test'

/**
 * Smoke-тест на API endpoint /api/contact с прохождением Turnstile + ratelimit.
 *
 * UI-flow с реальным Turnstile-widget невозможен в headless Chrome — Cloudflare
 * detect headless и не отдаёт токен (даже с тестовым sitekey). Проверять рендер
 * iframe — задача визуальной регрессии, не E2E API.
 *
 * Здесь тестируем API-уровень: при правильно настроенном `TURNSTILE_SECRET_KEY`
 * (на Preview = тестовый ключ `1x0000000000000000000000000000000AA`) сервер
 * принимает ЛЮБОЙ непустой токен → возвращает 200 + создаёт лид в CRM.
 *
 * Этот тест проверяет полный chain через server: ratelimit → zod-validation →
 * Turnstile-verify → forward в CRM webhook (с x-webhook-secret) → response.
 *
 * UI-форма с Turnstile-виджетом проверена вручную на проде: invisible managed
 * mode пропускает обычных юзеров (Сергей: лид от 19:33 в CRM подтвердил).
 */
test('API /api/contact принимает лид с тестовым Turnstile-токеном', async ({
  request,
}) => {
  const response = await request.post('/api/contact', {
    data: {
      name: 'E2E Playwright',
      phone: '+79991111111',
      type: 'callback',
      message: 'API-level test через test Turnstile secret',
      turnstile_token: 'E2E-DUMMY-TOKEN-CONTACT',
    },
  })

  expect(response.status()).toBe(200)
  const json = await response.json()
  expect(json.ok).toBe(true)
  expect(json.tg_link).toMatch(/^https:\/\/t\.me\//)
})

test('API /api/contact отклоняет POST без turnstile_token (zod 400)', async ({
  request,
}) => {
  const response = await request.post('/api/contact', {
    data: { name: 'X', phone: '+71112223344', type: 'callback' },
  })
  expect(response.status()).toBe(400)
  const json = await response.json()
  expect(json.error).toMatch(/[Cc]aptcha/)
})

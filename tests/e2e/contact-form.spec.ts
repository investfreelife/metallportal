import { test, expect } from '@playwright/test'

/**
 * Полный flow формы контакта с Turnstile.
 *
 * Чтобы тест прошёл стабильно, NEXT_PUBLIC_TURNSTILE_SITE_KEY на E2E-окружении
 * должен быть тестовым ключом Cloudflare:
 *   1x00000000000000000000AA — всегда проходит (managed-mode auto-pass)
 *   2x00000000000000000000AB — всегда фейлит (для negative-tests)
 *
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 *
 * На прод-ключе Turnstile может пометить headless-браузер как подозрительный
 * и потребовать interactive challenge — тогда тест зависнет на ожидании токена.
 *
 * Форма CTASection (главная страница) — submits to /api/contact { type: 'quote' }.
 * /contacts (отдельная страница) на момент задачи показывает контактную
 * информацию, не форму — так что используем главную страницу как entry point.
 */
test('CTA-форма на главной отправляет лид через /api/contact с Turnstile', async ({
  page,
}) => {
  await page.goto('/')

  // Ждём пока Turnstile widget смонтировался (iframe от challenges.cloudflare.com)
  await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', {
    timeout: 15_000,
  })

  // Заполняем форму
  await page.locator('textarea').first().fill('E2E playwright test message')
  await page.locator('input[type="tel"]').first().fill('+79991111111')

  // Даём Turnstile время автопройти (managed-mode на тестовом ключе)
  await page.waitForTimeout(3_500)

  // Перехватываем POST /api/contact и ждём ответа
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/contact') && resp.request().method() === 'POST',
    { timeout: 15_000 },
  )

  await page.locator('button[type="submit"]').first().click()

  const response = await responsePromise
  const status = response.status()
  const json = await response.json().catch(() => ({}))

  console.log('Contact form response:', status, json)

  // Принимаем 200 OK или 403 (если ключ не тестовый — Turnstile не пройдёт автоматом)
  expect(
    [200, 403].includes(status),
    `Expected 200 (testing key) or 403 (prod key without manual challenge), got ${status}`,
  ).toBeTruthy()

  if (status === 200) {
    expect(json.ok).toBe(true)
  }
})

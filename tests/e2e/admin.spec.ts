import { test, expect } from '@playwright/test'

/**
 * Admin login flow + price edit + reload-persistence check.
 *
 * Требует переменные окружения:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD — тестовый аккаунт с ролью admin.
 *
 * НЕ использовать боевые credentials — создать отдельный invite через
 * /admin/users → роль admin → задать пароль через /auth/reset-password.
 */
test.describe('admin', () => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD не заданы — создай тестовый admin-аккаунт',
  )

  test('login → /admin/products → edit price → reload → saved', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL!
    const password = process.env.E2E_ADMIN_PASSWORD!

    // 1. Login
    await page.goto('/admin')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin/, { timeout: 15_000 })

    // 2. Navigate to /admin/products via direct URL (sidebar link selector варьируется)
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')

    // 3. Edit first product price (InlineEdit pattern: click span, fill input, Enter)
    const firstPriceCell = page
      .locator('td, span')
      .filter({ hasText: /\d/ })
      .first()
    await firstPriceCell.click()

    const priceInput = page.locator('input[type="number"]').first()
    await expect(priceInput).toBeVisible({ timeout: 5_000 })

    const newPrice = '12345'
    await priceInput.fill(newPrice)

    // Перехватываем PATCH ответ
    const patchPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/admin/products/') &&
        resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    )
    await priceInput.press('Enter')
    const patchResponse = await patchPromise
    expect(patchResponse.status()).toBeLessThan(400)

    // 4. Reload и проверяем что цена сохранилась
    await page.reload()
    await page.waitForLoadState('networkidle')

    // На странице должна где-то отображаться `12345` (или близко — формат может варьироваться)
    await expect(page.getByText(newPrice).first()).toBeVisible({ timeout: 10_000 })
  })
})

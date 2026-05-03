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

    // 1. Login. AdminGuard rendered as login form when stage='logged_out'.
    //    После signInWithPassword stage переходит в 'admin' → AdminSidebar
    //    появляется (только в admin/designer). Используем sidebar как
    //    маркер успешного login.
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')

    await expect(page.locator('aside')).toBeVisible({ timeout: 20_000 })

    // 2. Direct navigate to products page. AdminGuard re-checks role on
    //    каждой /admin/* странице — sidebar пере-рендерится после check.
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('aside')).toBeVisible({ timeout: 20_000 })

    // 3. Дождаться загрузки таблицы товаров. h1 "Товары" — стабильный маркер.
    await expect(page.locator('h1:has-text("Товары")')).toBeVisible({
      timeout: 15_000,
    })

    // Filter to predictable subset с big-price products (₽/т товары).
    // По умолчанию admin/products сортируется alphabetical by name (.order('name')),
    // поэтому "А..." товары первые. После W2-anchors волны (PR #35) первая
    // строка — anchor с ценой 2.485 ₽/шт (3 digits + decimal), что breaks
    // `\d{5,}` regex assumption. Search "круг" даёт subset где все цены
    // в ₽/т (5-6 digits), что предсказуемо matches regex.
    await page.fill('input[placeholder="Поиск по названию..."]', 'круг')
    // Wait for debounced fetch: API call после изменения search.
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/admin/products') && resp.url().includes('search='),
      { timeout: 10_000 },
    )

    // Найти ценовую ячейку (5+ цифр — типичный формат прайса ₽/т в каталоге
    // 12345..999999). InlineEdit рендерит outer<span onClick> → inner<span> с
    // числом. Inner viewable, click bubbles to outer.
    const priceCell = page
      .locator('span')
      .filter({ hasText: /^\s*\d{5,}\s*$/ })
      .first()
    await priceCell.scrollIntoViewIfNeeded()
    await expect(priceCell).toBeVisible({ timeout: 10_000 })
    await priceCell.click()

    const priceInput = page.locator('input[type="number"]').first()
    await expect(priceInput).toBeVisible({ timeout: 5_000 })

    // Уникальная цена на каждый прогон — иначе тест не сработает повторно
    // (если в прошлом проходе price уже = 12345, fill('12345') → val===value → save no-op).
    const newPrice = String(10000 + Math.floor(Math.random() * 89999))
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

    // 4. Reload — проверяем что цена сохранилась.
    //    Без networkidle: chat-poller держит запросы каждые 5с.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1:has-text("Товары")')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(newPrice).first()).toBeVisible({ timeout: 10_000 })
  })
})

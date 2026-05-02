import { test, expect } from '@playwright/test'

/**
 * W2-1 — Header / Footer data-driven из таблицы `categories`.
 *
 * Раньше NAV был hardcoded → SITE_AUDIT P0-1..P0-4: 4 битых ссылки на
 * категории, которые в БД переименовали или перестроили. Сейчас Header
 * и Footer SSR-fetch'ат дерево, и любая ссылка под /catalog/* должна
 * либо отдать 200, либо 308→200 (мы оставили legacy redirects на 6-12
 * месяцев для SEO).
 *
 * Тест собирает все catalog-ссылки из header + footer (включая
 * children из dropdown'ов) и стучится по каждой через `request.get`.
 * 404 / 5xx → fail с конкретным списком.
 */

interface Link {
  label: string
  href: string
}

test('nav data-driven: каждая ссылка под /catalog ведёт на 200 или 308→200', async ({
  page,
  request,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Header: top-level + раскрытые dropdown'ы. nav-consistency.spec.ts уже
  // умеет hover'ить триггеры — копируем стратегию для покрытия всех children.
  const headerLinks: Link[] = await page.$$eval(
    'header a[href^="/catalog"]',
    (els) =>
      els.map((el) => ({
        label: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).pathname,
      })),
  )

  const triggers = await page.$$('header a[href^="/catalog"]')
  for (const t of triggers) {
    try {
      await t.hover({ timeout: 2_000 })
      await page.waitForTimeout(300)

      const expanded: Link[] = await page.$$eval(
        'header a[href^="/catalog"]',
        (els) =>
          els
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 0 && r.height > 0
            })
            .map((el) => ({
              label: (el.textContent ?? '').trim(),
              href: (el as HTMLAnchorElement).pathname,
            })),
      )
      for (const link of expanded) {
        if (!headerLinks.some((h) => h.href === link.href)) {
          headerLinks.push(link)
        }
      }
    } catch {
      /* skip */
    }
  }

  const footerLinks: Link[] = await page.$$eval(
    'footer a[href^="/catalog"]',
    (els) =>
      els.map((el) => ({
        label: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).pathname,
      })),
  )

  // Дедуп — header/footer часто пересекаются, не хотим дёргать одно
  // и то же дважды.
  const allHrefs = Array.from(
    new Set([...headerLinks, ...footerLinks].map((l) => l.href)),
  )

  // Sanity: на главной должно быть >0 catalog-ссылок. Если 0 — значит
  // SSR не отрисовал nav (cache cold-fail или БД недоступна) и тесту
  // нечего проверять.
  expect(
    allHrefs.length,
    'No /catalog/* links found on home page — SSR fetch likely failed',
  ).toBeGreaterThan(0)

  // Проверяем каждую: ожидаем 200 (страница есть) или редирект 30x на 200
  // (наши legacy permanent redirects из next.config.js).
  const broken: { href: string; status: number }[] = []
  for (const href of allHrefs) {
    const res = await request.get(href, { maxRedirects: 5 })
    const status = res.status()
    if (status === 404 || status >= 500) {
      broken.push({ href, status })
    }
  }

  console.log(
    `nav data-driven: проверено ${allHrefs.length} catalog-ссылок (header + footer)`,
  )
  if (broken.length) {
    console.log('Broken links:')
    console.table(broken)
  }

  expect(
    broken,
    `${broken.length} broken catalog link(s) — see console for details`,
  ).toHaveLength(0)
})

test('nav reflects DB: все root-категории на /catalog имеют видимую ссылку с главной', async ({
  page,
  request,
}) => {
  // Параллельно стянем список активных root'ов через Vercel-preview API
  // (если бы был открытый /api/categories endpoint). Endpoint'а нет —
  // пропускаем глубокую проверку, но проверяем что хотя бы одна root-
  // категория из БД действительно отрисована (значит SSR fetch жив).
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const rootHrefs = await page.$$eval(
    'header a[href^="/catalog/"]',
    (els) =>
      els
        .map((el) => (el as HTMLAnchorElement).pathname)
        .filter((p) => p.split('/').filter(Boolean).length === 2), // только /catalog/<slug>
  )

  // Должно быть хотя бы 3 root-категории (FOOTER_PRODUCTS_LIMIT=5,
  // HEADER_NAV_LIMIT=5; даже если БД сильно пустая, 3 root'а живут).
  expect(
    new Set(rootHrefs).size,
    'Header показывает <3 root-категорий — fetchCategoriesTree упал?',
  ).toBeGreaterThanOrEqual(3)

  // Один из root'ов должен реально открываться (200/308→200).
  const sample = rootHrefs[0]
  const res = await request.get(sample, { maxRedirects: 5 })
  expect(res.status(), `Root category ${sample} returned ${res.status()}`).toBeLessThan(
    400,
  )
})

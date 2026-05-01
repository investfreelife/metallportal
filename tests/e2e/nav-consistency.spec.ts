import { test, expect } from '@playwright/test'

test('Header и Footer указывают на одни и те же slug-и для общих категорий', async ({
  page,
}) => {
  await page.goto('/')

  const headerLinks = await page.$$eval(
    'header a[href*="/catalog/"]',
    (els) =>
      els.map((el) => ({
        label: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).pathname,
      })),
  )

  const footerLinks = await page.$$eval(
    'footer a[href*="/catalog/"]',
    (els) =>
      els.map((el) => ({
        label: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).pathname,
      })),
  )

  // Конфликты: одинаковая метка → разные href
  const conflicts: { label: string; header: string; footer: string }[] = []
  for (const h of headerLinks) {
    for (const f of footerLinks) {
      if (
        h.label.toLowerCase() === f.label.toLowerCase() &&
        h.href !== f.href
      ) {
        conflicts.push({ label: h.label, header: h.href, footer: f.href })
      }
    }
  }

  console.log(`Header links: ${headerLinks.length}, Footer links: ${footerLinks.length}`)
  if (conflicts.length) console.table(conflicts)

  expect(
    conflicts,
    `Header↔Footer slug mismatch on ${conflicts.length} label(s)`,
  ).toHaveLength(0)
})

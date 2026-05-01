import { test, expect } from '@playwright/test'

/**
 * Catches Header ↔ Footer slug mismatches for category links.
 *
 * Header in metallportal renders top-level dropdown triggers (Металлопрокат,
 * Готовые конструкции) and shows children only on hover. So a naive
 * `header a[href*="/catalog/"]` query sees only 2 top-level links and misses
 * the SITE_AUDIT P0-1..P0-4 conflicts on category-children labels
 * (Арматура / Трубы / Лист / Балки).
 *
 * Strategy:
 *   1. Capture top-level header catalog links (always rendered).
 *   2. For each top-level dropdown trigger — hover, wait for children to
 *      animate-in, capture all newly visible /catalog/* links.
 *   3. Capture all footer catalog links.
 *   4. Compare labels case-insensitively; conflict = same label, different
 *      pathname.
 */

interface Link {
  label: string
  href: string
}

test('Header и Footer указывают на одни и те же slug-и для общих категорий', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // Не ждём networkidle — Cloudflare / Vercel / Turnstile держат сеть постоянно

  // Step 1: top-level header catalog links (already in DOM)
  const headerLinks: Link[] = await page.$$eval(
    'header a[href*="/catalog/"]',
    (els) =>
      els.map((el) => ({
        label: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).pathname,
      })),
  )

  // Step 2: hover each top-level dropdown trigger to render children.
  //   Triggers themselves are <Link> + sibling <button> with ChevronDown — hover
  //   on the wrapper div (parent of <Link>) fires onMouseEnter on the dropdown.
  //   We approach it via direct hover on the visible top-level <Link>.
  const topLevelTriggers = await page.$$('header a[href*="/catalog/"]')
  for (const trigger of topLevelTriggers) {
    try {
      await trigger.hover({ timeout: 2_000 })
      // Animation + onMouseEnter → setOpen(href) → dropdown renders
      await page.waitForTimeout(400)

      // Capture children that just appeared. Header dropdown panel is
      // `.absolute.top-full ...` containing nested links. We grab everything
      // currently visible under header that wasn't in the initial set.
      const childrenLinks: Link[] = await page.$$eval(
        'header a[href*="/catalog/"]',
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
      // Merge any new entries into headerLinks (dedupe by href+label)
      for (const c of childrenLinks) {
        if (!headerLinks.some((h) => h.href === c.href && h.label === c.label)) {
          headerLinks.push(c)
        }
      }
    } catch {
      /* trigger not hoverable — skip */
    }
  }

  // Step 3: footer catalog links
  const footerLinks: Link[] = await page.$$eval(
    'footer a[href*="/catalog/"]',
    (els) =>
      els.map((el) => ({
        label: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).pathname,
      })),
  )

  // Step 4: detect conflicts
  const conflicts: { label: string; header: string; footer: string }[] = []
  for (const h of headerLinks) {
    if (!h.label) continue
    for (const f of footerLinks) {
      if (!f.label) continue
      if (
        h.label.toLowerCase() === f.label.toLowerCase() &&
        h.href !== f.href
      ) {
        // Avoid duplicate same conflict tuple
        const exists = conflicts.some(
          (c) =>
            c.label === h.label &&
            c.header === h.href &&
            c.footer === f.href,
        )
        if (!exists) {
          conflicts.push({ label: h.label, header: h.href, footer: f.href })
        }
      }
    }
  }

  // Also surface label-substring matches for catalog-singular labels (Footer often
  // says "Арматура" while Header dropdown says "Арматура и сетка") — these are
  // soft-conflicts the user perceives as the same product family.
  const softConflicts: { label: string; header: string; footer: string }[] = []
  for (const f of footerLinks) {
    const fLower = f.label.toLowerCase().replace(/ё/g, 'е')
    if (!fLower) continue
    for (const h of headerLinks) {
      const hLower = h.label.toLowerCase().replace(/ё/g, 'е')
      if (!hLower) continue
      if (h.href === f.href) continue
      // Footer label is a prefix word of Header label (e.g. "трубы" ⊂ "трубы и профиль")
      const fFirst = fLower.split(/\s+/)[0]
      const hFirst = hLower.split(/\s+/)[0]
      if (fFirst.length >= 4 && hFirst === fFirst) {
        const exists =
          softConflicts.some(
            (c) =>
              c.label === f.label && c.header === h.href && c.footer === f.href,
          ) ||
          conflicts.some(
            (c) => c.header === h.href && c.footer === f.href,
          )
        if (!exists) {
          softConflicts.push({
            label: `${f.label} ⊂ ${h.label}`,
            header: h.href,
            footer: f.href,
          })
        }
      }
    }
  }

  console.log(`Header links (incl. dropdown children): ${headerLinks.length}`)
  console.log(`Footer links: ${footerLinks.length}`)
  if (conflicts.length) {
    console.log('Hard conflicts (same label, different href):')
    console.table(conflicts)
  }
  if (softConflicts.length) {
    console.log('Soft conflicts (Footer label is prefix of Header label):')
    console.table(softConflicts)
  }

  // Hard conflicts fail the test. Soft conflicts log-only — they may be valid
  // (Footer abbreviations ↔ Header full names) and warrant manual review.
  expect(
    conflicts,
    `Header↔Footer hard slug mismatch on ${conflicts.length} label(s)`,
  ).toHaveLength(0)
})

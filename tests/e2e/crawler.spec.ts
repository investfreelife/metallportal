import { test, expect } from '@playwright/test'

const SAMPLE_PER_DEPTH = 10 // ограничение: не более 10 ссылок с каждой страницы
const MAX_DEPTH = 3

test('crawler: все internal-ссылки от главной должны быть 200', async ({ page }) => {
  const visited = new Set<string>()
  const broken: { url: string; from: string; status: number }[] = []
  const queue: { url: string; depth: number; from: string }[] = [
    { url: '/', depth: 0, from: 'root' },
  ]

  const baseURL = test.info().project.use.baseURL!
  const baseHost = new URL(baseURL).host

  while (queue.length > 0) {
    const { url, depth, from } = queue.shift()!
    if (visited.has(url)) continue
    if (depth > MAX_DEPTH) continue
    visited.add(url)

    let status = 0
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      })
      status = response?.status() ?? 0
    } catch (err) {
      broken.push({ url, from, status: 0 })
      continue
    }

    if (status >= 400) {
      broken.push({ url, from, status })
      continue
    }

    // Internal-ссылки на этой странице
    const links = await page.$$eval('a[href]', (els) =>
      els
        .map((el) => (el as HTMLAnchorElement).href)
        .filter(
          (h) =>
            h &&
            !h.startsWith('mailto:') &&
            !h.startsWith('tel:') &&
            !h.startsWith('javascript:') &&
            !h.startsWith('#'),
        ),
    )

    for (const href of links.slice(0, SAMPLE_PER_DEPTH)) {
      try {
        const u = new URL(href)
        if (u.host !== baseHost) continue
        const pathOnly = u.pathname + u.search
        if (!visited.has(pathOnly)) {
          queue.push({ url: pathOnly, depth: depth + 1, from: url })
        }
      } catch {
        /* invalid URL — skip */
      }
    }
  }

  console.log(`Visited: ${visited.size} pages`)
  console.log(`Broken: ${broken.length} links`)
  if (broken.length) console.table(broken)

  expect(broken, `${broken.length} broken links found`).toHaveLength(0)
})

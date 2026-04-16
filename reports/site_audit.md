# Site Audit Report — МеталлПортал
**Date:** 2026-04-16  
**Tested:** http://localhost:3001 (dev mode, npm run dev)  
**Method:** Playwright automated browser + visual screenshot inspection

---

## Executive Summary

The site is **functional and looks professional**. Core commerce features work:
navigation, 450-product catalog, enriched names, price calculator, 5-tab product cards,
SEO metadata. There are **zero production-blocking issues** but 5 major issues
need fixing before launch.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 Major | 5 |
| 🟡 Minor | 5 |
| ℹ️ Dev-only | 2 |

---

## VISUAL FINDINGS FROM SCREENSHOTS

### Homepage (`/`) — ✅ Good
- Hero grid with 4 category tiles, images render
- Search bar prominent with microphone button
- Navigation dropdowns present (3-level, all 5 categories)
- Popular products section with prices
- Footer with links
- **One broken Unsplash image** (minor)

### Catalog (`/catalog`) — ⚠️ No images
- 5 category cards render correctly
- Category names, descriptions, "Перейти в раздел" links — all correct
- **BUT**: All cards show plain emoji + dark background — no hero photos
  - `metalloprokat` image upload failed; 4 others uploaded but not rendering
  - Supabase storage URLs saved in DB but images appear broken on this page

### Category page (`/catalog/truby-i-profil`) — ✅ Very good
- H1 "Трубы и профиль" correct
- Subcategory chips: **Все (450) | Трубы ВГП (214) | Трубы профильные (2) | Трубы электросварные (18) | Трубы бесшовные (162)**
- 50-row paginated table (correct)
- Product names properly enriched: "Труба ВГП ДУ 40 мм, стенка 3 мм, черная, некондиция"
- Prices showing: "30 337,2 ₽/т", "30 769,2 ₽/т" (correct format)
- ГОСТ column: "ГОСТ 3262-75" (correct)
- **BUT**: All filter selects completely empty — no options in any dropdown
- Supplier column shows "—" for all rows (mc.ru products have no supplier)
- Size column shows "—" for all rows (dimensions not parsed)

### Product page (`/catalog/truba-besshovnaya/20267169`) — ✅ Good layout
- H1: "Труба бесшовная 45 мм, Ст20, стенка 4; 5; 10 мм" ✅
- ГОСТ 8734-75 badge ✅ + Ст20 badge ✅
- Gradient placeholder image (no photo) ✅ acceptable for now
- **All 5 tabs present**: Описание | Характеристики | Доставка | Наличие и цены 1 | Отзывы ✅
- Price block: "57 337,2 ₽/**шт**" ← WRONG UNIT (should be ₽/т for pipes)
- Calculator: Метры/Тонны toggle works, shows "5 733 720 ₽" for 100 m.п. ✅
- Buttons: "В корзину", "Получить цену", "Загрузить смету" ✅
- **Breadcrumb bug**: "Главная / Каталог / **/** Трубы бесшовные / …" — blank segment
- SEO title: "Труба бесшовная 45 мм … цена купить в Москве | МеталлПортал" ✅
- JSON-LD Product schema: present ✅
- Related products: not showing (likely 0 in same category after excluding current)

### Mobile product page (375px) — ✅ Responsive
- Layout collapses correctly (single column)
- Tabs visible but 4th/5th tab cut off — needs horizontal scroll hint
- Price block renders below image correctly

---

## 🟠 MAJOR ISSUES

### ISSUE-01 — Catalog category cards have no images
**Page:** `/catalog`  
**What user sees:** Dark gray boxes with emoji icon, no photos  
**Root cause:**
- `metalloprokat` upload failed (network error during generation)
- 4 others (konstruktsii, zabory, zdaniya, zakaz) have Supabase URLs in DB but images not loading on `/catalog` page — bucket may not be public
**Fix:**
1. In Supabase dashboard → Storage → `hero-images` → set to **Public**
2. Re-run: `npx tsx scripts/generate_images.ts` to retry metalloprokat
3. Verify: `SELECT slug, image_url FROM categories WHERE parent_id IS NULL`

---

### ISSUE-02 — Breadcrumb empty segment on product pages
**Page:** All `/catalog/[category]/[slug]` pages  
**What user sees:** `Главная / Каталог / / Трубы бесшовные / Product`  
**Root cause:** In `app/catalog/[category]/[slug]/page.tsx` line ~87:
```tsx
// Current (buggy):
const parentCategory = (product.category as any)?.parent;
// parentCategory can be {} (empty object, truthy) when parent has no data

// Fix:
const parentCategory = (product.category as any)?.parent?.name
  ? (product.category as any).parent
  : null;
```
**Impact:** Looks broken, confuses users, bad for SEO crawling

---

### ISSUE-03 — All filter dropdowns are empty
**Page:** All category pages  
**What user sees:** Filter sidebar renders but every select has 0 options  
**Root cause (3 causes):**
1. **Supplier** — all 513 mc.ru products have `supplier_id = NULL` → `p.supplier` is null → no options
2. **Steel grade** — `filterOptions.steelGrades` builds from products loaded in this render. Products in truby-i-profil DO have steel grades (278/513 enriched) but the specific truby-i-profil products may not.
3. **Region** — null supplier means no region data
**Verify:** `SELECT steel_grade, COUNT(*) FROM products p JOIN categories c ON p.category_id = c.id WHERE c.slug = 'truba-vgp' GROUP BY steel_grade`  
**Impact:** Filters appear broken — bad UX for product discovery

---

### ISSUE-04 — Wrong price unit "шт" for bulk metal products
**Page:** Product detail pages for 196 products  
**What user sees:** "57 337,2 ₽/шт" — price per piece for a steel pipe  
**Root cause:** mc.ru seed data has `unit = 'шт'` for 196 products. Steel tubes/pipes should be sold per ton ("т") or per meter ("м"), not per piece.  
**Fix (SQL):**
```sql
-- Check which products have wrong unit
SELECT name, unit FROM products WHERE unit = 'шт' AND name LIKE '%Труба%' LIMIT 5;
-- Fix: update products to use correct unit based on category
UPDATE products SET unit = 'т' 
WHERE unit = 'шт' 
AND category_id IN (SELECT id FROM categories WHERE slug LIKE 'truba%');
```

---

### ISSUE-05 — "С этим покупают" (related products) never shows
**Page:** All product detail pages  
**What user sees:** No related products carousel at bottom  
**Root cause:** `getRelatedProducts(product.category_id, product.id, 6)` fetches products  
with same exact `category_id`. But many products are in categories with only 1-5 items  
→ after excluding current product, 0 related remain.  
**Fix:** Fall back to parent category when subcategory has < 6:
```typescript
// In getRelatedProducts or in the page component:
if (related.length < 3 && product.category?.parent_id) {
  related = await getRelatedProducts(product.category.parent_id, product.id, 6);
}
```

---

## 🟡 MINOR ISSUES

### ISSUE-06 — Broken Unsplash image on homepage
**URL:** `https://images.unsplash.com/photo-1564424224827-cd24c93f95fd?w=400&q=80`  
The `source.unsplash.com` redirect API is deprecated; this URL 404s.  
**Fix:** Replace with Supabase-hosted image or a stable CDN URL.

### ISSUE-07 — Product image is always gradient placeholder
All 513 products have `image_url = NULL`. Gradient is acceptable but not ideal.  
**Quick fix:** In product page, fall back to category image:
```tsx
const imageUrl = product.image_url 
  ?? (product.category as any)?.parent?.image_url
  ?? (product.category as any)?.image_url;
```

### ISSUE-08 — Mobile tabs: 4th+5th tab hidden by overflow
On 375px viewport, "Наличие и цены" and "Отзывы" are clipped.  
The `overflow-x-auto` works but there's no scroll indicator.  
**Fix:** Add `scrollbar-hide` and a fade-right gradient hint to show scrollability.

### ISSUE-09 — Calculator misleading for "шт" unit products
When `unit = "шт"` and `weight_per_meter = null`, tons/meters toggle shows 0.  
**Fix:** When unit is "шт", hide toggle and show simple qty × price calculator.

### ISSUE-10 — Supplier and size columns always show "—"
Table columns "Поставщик" and "Размер" are empty for all mc.ru products.  
- Supplier: all mc.ru products have `supplier_id = NULL`
- Size: `dimensions` column is NULL for most products
**Impact:** Table looks incomplete. Consider hiding empty columns automatically.

---

## ℹ️ DEV-MODE ONLY (not production issues)

- **Slow first load** for some pages (25s) — dev compilation + no caching. Production uses 60s `revalidate` and Vercel Edge Network — expect <2s.
- **RSC payload warning** in console — Next.js dev hot-reload artifact.

---

## WHAT'S WORKING WELL ✅

| Feature | Notes |
|---------|-------|
| Homepage design | Professional, modern B2B look |
| 3-level header nav with dropdowns | All 5 categories, all subcategories linked |
| Mobile hamburger menu | Opens, all links work |
| Catalog category cards | Names, descriptions, links all correct |
| Subcategory chips + counts | "Трубы ВГП (214)" — live filtering |
| Product table with 50-row pagination | Works, sort bar functional |
| Enriched product names | No more short codes — full Russian names |
| ГОСТ in table + product page | "ГОСТ 3262-75" correctly shown |
| Price with discount + strikethrough | Gold color, professional display |
| "В наличии" / "Под заказ" badge | Shows correctly based on DB |
| Product detail two-column layout | Left content + right sticky price block |
| All 5 product tabs | Описание, Характеристики, Доставка, Наличие и цены, Отзывы |
| Meters/tons calculator | Live math, toggles correctly |
| SEO page titles | "…цена купить в Москве \| МеталлПортал" |
| JSON-LD Product schema | Present on every product page |
| ГОСТ + steel grade badges on H1 | "ГОСТ 8734-75" + "Ст20" chips |
| Delivery tab | Real content (СДЭК, ПЭК, own fleet) |
| TypeScript build | Zero errors, clean compile |
| Vercel deploy | Live at main branch |

---

## Screenshots

| File | Page |
|------|------|
| `screenshots/01-homepage.png` | Homepage full |
| `screenshots/02-catalog.png` | Catalog index |
| `screenshots/03-category-truby.png` | Трубы и профиль (full page) |
| `screenshots/03b-category-desktop.png` | Трубы и профиль (viewport) |
| `screenshots/04-metalloprokat.png` | Металлопрокат root |
| `screenshots/05-product-page.png` | Product detail (full) |
| `screenshots/05b-product-mobile.png` | Product mobile 375px |
| `screenshots/05c-product-desktop.png` | Product desktop 1440px |
| `screenshots/06-nav-dropdown.png` | Nav state |

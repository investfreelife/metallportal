/**
 * QA audit script — screenshots + issues for site_audit.md
 */
import { chromium, Page } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3001";
const REPORT_DIR = join(process.cwd(), "reports");
const SS_DIR = join(REPORT_DIR, "screenshots");

mkdirSync(SS_DIR, { recursive: true });

interface Issue {
  page: string;
  severity: "critical" | "major" | "minor";
  description: string;
  detail?: string;
}

const issues: Issue[] = [];

function add(page: string, severity: Issue["severity"], description: string, detail?: string) {
  issues.push({ page, severity, description, detail });
  console.log(`  [${severity.toUpperCase()}] ${description}${detail ? `: ${detail.slice(0, 80)}` : ""}`);
}

async function screenshotAndAnalyze(page: Page, name: string, url: string) {
  console.log(`\n--- Auditing ${url} ---`);
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: join(SS_DIR, `${name}.png`),
      fullPage: true,
    });
    return res?.status() ?? 0;
  } catch (e: any) {
    add(url, "critical", "Page failed to load", e.message);
    return 0;
  }
}

async function auditHomepage(page: Page) {
  const status = await screenshotAndAnalyze(page, "01-homepage", BASE);
  if (status !== 200) add("/", "critical", `HTTP ${status}`);

  // Check hero section
  const heroText = await page.evaluate(() => document.querySelector("h1, h2")?.textContent?.trim());
  console.log(`  H1/H2: ${heroText}`);
  if (!heroText) add("/", "major", "No H1/H2 heading found on homepage");

  // Check category cards
  const cards = await page.$$("[href*='/catalog/']");
  console.log(`  Catalog links: ${cards.length}`);
  if (cards.length === 0) add("/", "critical", "No catalog links on homepage");

  // Check images
  const brokenImages = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    return imgs.filter(img => !img.naturalWidth && img.complete).map(img => img.src);
  });
  if (brokenImages.length) add("/", "minor", `${brokenImages.length} broken images`, brokenImages.join(", "));

  // Check nav
  const navLinks = await page.$$("header a, header button");
  console.log(`  Header elements: ${navLinks.length}`);
  if (navLinks.length < 3) add("/", "major", "Header navigation appears broken");

  // Check for JS errors
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  if (errors.length) add("/", "major", "JS errors on page", errors.join("; "));
}

async function auditCatalogPage(page: Page) {
  const status = await screenshotAndAnalyze(page, "02-catalog", `${BASE}/catalog`);
  if (status !== 200) add("/catalog", "critical", `HTTP ${status}`);

  // Count category cards
  const categoryCards = await page.$$("a[href*='/catalog/']");
  console.log(`  Category links: ${categoryCards.length}`);
  if (categoryCards.length < 3) add("/catalog", "critical", "Very few category cards visible");

  // Check category names
  const names = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href*='/catalog/'] h2, a[href*='/catalog/'] span")).map(el => (el as HTMLElement).innerText?.trim()).filter(Boolean)
  );
  console.log(`  Category names: ${names.slice(0, 5).join(", ")}`);

  // Check images on category cards
  const imgSrcs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href*='/catalog/'] img")).map((img: any) => ({ src: img.src, naturalWidth: img.naturalWidth }))
  );
  const broken = imgSrcs.filter(i => !i.naturalWidth);
  console.log(`  Category images: ${imgSrcs.length} total, ${broken.length} broken`);
  if (broken.length > 0) add("/catalog", "minor", `${broken.length} category images missing (no hero images generated)`);
  if (imgSrcs.length === 0) add("/catalog", "major", "No category images at all — placeholder divs shown");
}

async function auditCategoryPage(page: Page) {
  const url = `${BASE}/catalog/truby-i-profil`;
  const status = await screenshotAndAnalyze(page, "03-category-truby", url);
  if (status !== 200) add(url, "critical", `HTTP ${status}`);

  // H1
  const h1 = await page.$eval("h1", el => (el as HTMLElement).innerText).catch(() => null);
  console.log(`  H1: ${h1}`);
  if (!h1) add(url, "major", "No H1 on category page");

  // Subcategory chips
  const chips = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).filter(b => b.closest("[class*='flex']")).map(b => b.innerText?.trim()).filter(Boolean)
  );
  console.log(`  Subcategory chips: ${chips.slice(0, 6).join(", ")}`);
  if (chips.length < 2) add(url, "major", "Subcategory chips not rendering");

  // Product count
  const countText = await page.evaluate(() => {
    const el = document.querySelector("[class*='text-sm'][class*='muted']") as HTMLElement | null;
    return el?.innerText;
  });
  console.log(`  Product count text: ${countText}`);

  // Table rows
  const rows = await page.$$("tbody tr");
  console.log(`  Table rows: ${rows.length}`);
  if (rows.length === 0) add(url, "critical", "Product table is empty — no products visible");

  // Check product names for short codes (original seed names are < 30 chars with patterns like "ДУ 25")
  const productNames = await page.evaluate(() =>
    Array.from(document.querySelectorAll("tbody td a")).map(a => (a as HTMLElement).innerText?.trim()).filter(Boolean).slice(0, 10)
  );
  console.log(`  Sample product names: ${productNames.slice(0, 3).join(" | ")}`);
  const shortCodes = productNames.filter(n => n.length < 20 && /^[А-Я0-9]/.test(n));
  if (shortCodes.length > 0) add(url, "major", `${shortCodes.length} products still have short seed codes`, shortCodes.join(", "));

  // Check price column
  const prices = await page.evaluate(() =>
    Array.from(document.querySelectorAll("tbody td")).filter(td => (td as HTMLElement).innerText?.includes("₽")).map(td => (td as HTMLElement).innerText?.trim()).slice(0, 5)
  );
  console.log(`  Price cells: ${prices.slice(0, 3).join(", ")}`);
  if (prices.length === 0) add(url, "major", "No prices visible in product table");

  // Filters sidebar
  const filterLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("select, input[type='number'], input[type='checkbox']")).length
  );
  console.log(`  Filter inputs: ${filterLabels}`);
  if (filterLabels < 4) add(url, "major", "Filter sidebar missing most inputs");

  // Screenshot desktop view
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(SS_DIR, "03b-category-desktop.png"), fullPage: false });
}

async function auditMetalloprokat(page: Page) {
  const url = `${BASE}/catalog/metalloprokat`;
  const status = await screenshotAndAnalyze(page, "04-metalloprokat", url);
  if (status !== 200) add(url, "critical", `HTTP ${status} — main category broken`);

  const rows = await page.$$("tbody tr");
  console.log(`  Metalloprokat rows: ${rows.length}`);
  if (rows.length === 0) add(url, "major", "Металлопрокат category page shows 0 products");
}

async function auditProductPage(page: Page) {
  // First, find a real product slug
  const catPage = await page.goto(`${BASE}/catalog/truba-besshovnaya`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const firstProductHref = await page.evaluate(() => {
    const a = document.querySelector("tbody td a");
    return (a as HTMLAnchorElement)?.href;
  });
  console.log(`  First product href: ${firstProductHref}`);

  if (!firstProductHref) {
    add("/catalog/truba-besshovnaya", "critical", "No products visible — cannot test product page");
    return;
  }

  const status = await screenshotAndAnalyze(page, "05-product-page", firstProductHref);
  if (status !== 200) add(firstProductHref, "critical", `Product page HTTP ${status}`);

  // H1
  const h1 = await page.$eval("h1", el => (el as HTMLElement).innerText).catch(() => null);
  console.log(`  Product H1: ${h1}`);
  if (!h1) add(firstProductHref, "critical", "No H1 on product page");
  if (h1 && h1.length < 15) add(firstProductHref, "major", "Product H1 is a short code (enrichment may not have applied)", h1);

  // Tabs
  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).filter(b => ["Описание","Характеристики","Доставка","Наличие и цены","Отзывы"].includes(b.innerText?.trim())).map(b => b.innerText.trim())
  );
  console.log(`  Tabs found: ${tabs.join(", ")}`);
  if (tabs.length < 5) add(firstProductHref, "major", `Only ${tabs.length}/5 tabs found`, tabs.join(", "));

  // Price block
  const goldPrices = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[class*='text-gold'], [class*='gold']")).map(el => (el as HTMLElement).innerText?.trim()).filter(n => n.includes("₽")).slice(0, 3)
  );
  console.log(`  Gold prices: ${goldPrices.join(", ")}`);
  if (goldPrices.length === 0) add(firstProductHref, "major", "No price block visible on product page");

  // Calculator
  const calcInputs = await page.$$("input[type='number']");
  console.log(`  Calculator inputs: ${calcInputs.length}`);
  if (calcInputs.length === 0) add(firstProductHref, "major", "Calculator input not found");

  // Breadcrumb
  const breadcrumb = await page.evaluate(() => {
    const nav = document.querySelector("nav");
    return nav?.innerText?.trim().replace(/\n/g, " > ");
  });
  console.log(`  Breadcrumb: ${breadcrumb}`);
  if (!breadcrumb?.includes("Каталог")) add(firstProductHref, "minor", "Breadcrumb missing or incorrect");

  // Related products
  const relatedSection = await page.$("section");
  if (!relatedSection) add(firstProductHref, "minor", '"С этим покупают" section not visible (likely no related products in DB)');

  // SEO title
  const title = await page.title();
  console.log(`  Page title: ${title}`);
  if (!title.includes("купить")) add(firstProductHref, "minor", "Page title missing SEO keywords", title);

  // JSON-LD
  const jsonLd = await page.evaluate(() => {
    const el = document.querySelector("script[type='application/ld+json']");
    return el?.textContent;
  });
  if (!jsonLd) add(firstProductHref, "minor", "JSON-LD schema markup missing");
  else console.log(`  JSON-LD: ✓ (${jsonLd.slice(0, 60)}...)`);

  // Image area
  const productImage = await page.evaluate(() => {
    const img = document.querySelector("img");
    return img ? { src: img.src, loaded: img.naturalWidth > 0 } : null;
  });
  console.log(`  Product image: ${JSON.stringify(productImage)}`);
  if (!productImage) add(firstProductHref, "minor", "No product image — gradient placeholder shown");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: join(SS_DIR, "05b-product-mobile.png"), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(SS_DIR, "05c-product-desktop.png"), fullPage: false });
}

async function auditNavigation(page: Page) {
  console.log("\n--- Auditing navigation ---");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Check all nav links in header resolve
  const navHrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("header a")).map(a => (a as HTMLAnchorElement).href).filter(h => h.includes("localhost"))
  );
  console.log(`  Header links: ${navHrefs.length}`);

  // Test hover dropdown
  const metalButton = await page.$("header button");
  if (metalButton) {
    await metalButton.hover();
    await page.waitForTimeout(500);
    const dropdown = await page.$("[class*='shadow']");
    console.log(`  Dropdown visible: ${!!dropdown}`);
    if (!dropdown) add("/", "major", "Header dropdown menu not appearing on hover");
    await page.screenshot({ path: join(SS_DIR, "06-nav-dropdown.png") });
  }

  // Check broken links (404s) for key pages
  const linksToCheck = [
    "/catalog",
    "/catalog/metalloprokat",
    "/catalog/truby-i-profil",
    "/catalog/armatura-i-setka",
    "/catalog/listy-i-plity",
  ];
  for (const link of linksToCheck) {
    try {
      const res = await page.goto(`${BASE}${link}`, { waitUntil: "domcontentloaded", timeout: 8000 });
      const status = res?.status() ?? 0;
      if (status === 404) add(link, "critical", `404 Not Found`);
      else if (status !== 200) add(link, "major", `HTTP ${status}`);
      else console.log(`  ${link}: ✓ ${status}`);
    } catch {
      add(link, "critical", `Timeout/error loading`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Collect console errors
  const consoleErrors: string[] = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  await auditHomepage(page);
  await auditCatalogPage(page);
  await auditCategoryPage(page);
  await auditMetalloprokat(page);
  await auditProductPage(page);
  await auditNavigation(page);

  if (consoleErrors.length > 0) {
    add("browser", "minor", `${consoleErrors.length} browser console errors`, consoleErrors.slice(0, 3).join("; "));
  }

  await browser.close();

  // Generate report
  const critical = issues.filter(i => i.severity === "critical");
  const major    = issues.filter(i => i.severity === "major");
  const minor    = issues.filter(i => i.severity === "minor");

  const report = `# Site Audit Report
Generated: ${new Date().toISOString()}

## Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | ${critical.length} |
| 🟠 Major | ${major.length} |
| 🟡 Minor | ${minor.length} |
| **Total** | **${issues.length}** |

---

## 🔴 Critical Issues (${critical.length})
${critical.length === 0 ? "_None_" : critical.map(i => `- **${i.page}**: ${i.description}${i.detail ? `\n  > ${i.detail}` : ""}`).join("\n")}

---

## 🟠 Major Issues (${major.length})
${major.length === 0 ? "_None_" : major.map(i => `- **${i.page}**: ${i.description}${i.detail ? `\n  > ${i.detail}` : ""}`).join("\n")}

---

## 🟡 Minor Issues (${minor.length})
${minor.length === 0 ? "_None_" : minor.map(i => `- **${i.page}**: ${i.description}${i.detail ? `\n  > ${i.detail}` : ""}`).join("\n")}

---

## Screenshots
All screenshots saved to \`reports/screenshots/\`:
- \`01-homepage.png\` — Homepage
- \`02-catalog.png\` — Catalog listing
- \`03-category-truby.png\` — Category page (Трубы)
- \`03b-category-desktop.png\` — Category desktop view
- \`04-metalloprokat.png\` — Металлопрокат root category
- \`05-product-page.png\` — Product detail
- \`05b-product-mobile.png\` — Product mobile view
- \`05c-product-desktop.png\` — Product desktop view
- \`06-nav-dropdown.png\` — Navigation dropdown
`;

  writeFileSync(join(REPORT_DIR, "site_audit.md"), report);
  console.log(`\n${"═".repeat(55)}`);
  console.log(`AUDIT COMPLETE`);
  console.log(`Critical: ${critical.length}  Major: ${major.length}  Minor: ${minor.length}`);
  console.log(`Report: reports/site_audit.md`);
  console.log(`Screenshots: reports/screenshots/`);
}

main().catch(e => { console.error(e); process.exit(1); });

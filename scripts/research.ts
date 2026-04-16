/**
 * Researches metall-dk.ru structure using Playwright headless browser.
 * Extracts navigation, filters, product table structure, product card layout.
 * Saves to research/metalldk.json
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  const result: any = {};

  // ─── 1. Catalog main page ───
  console.log("1. Fetching catalog main page...");
  try {
    await page.goto("https://metall-dk.ru/catalog/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    result.catalog_nav = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll(".catalog-menu a, .catalog-nav a, nav a, .menu-item a").forEach((a: any) => {
        const text = a.innerText?.trim();
        const href = a.href;
        if (text && href && href.includes("metall-dk.ru")) {
          items.push({ text, href });
        }
      });
      return items.slice(0, 50);
    });

    result.catalog_h1 = await page.evaluate(() => document.querySelector("h1")?.innerText?.trim());
    result.catalog_categories = await page.evaluate(() => {
      const cats: any[] = [];
      document.querySelectorAll(".catalog-section, .category-item, .section-item, [class*='catalog'] a").forEach((el: any) => {
        const text = el.innerText?.trim().split("\n")[0];
        const href = el.querySelector?.("a")?.href || el.href;
        if (text && text.length < 80) cats.push({ text, href });
      });
      return cats.slice(0, 30);
    });
  } catch (e: any) {
    result.catalog_error = e.message;
  }

  // ─── 2. Armatura category page ───
  console.log("2. Fetching armatura category...");
  try {
    await page.goto("https://metall-dk.ru/catalog/armatura/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    result.armatura = {};
    result.armatura.url = page.url();
    result.armatura.h1 = await page.evaluate(() => document.querySelector("h1")?.innerText?.trim());

    // Filters
    result.armatura.filters = await page.evaluate(() => {
      const filters: any[] = [];
      document.querySelectorAll(".filter, .filters, [class*='filter'] .filter-item, [class*='filter-block'], aside label, .sidebar label").forEach((el: any) => {
        const text = el.innerText?.trim().split("\n")[0];
        if (text && text.length < 60) filters.push(text);
      });
      return [...new Set(filters)].slice(0, 20);
    });

    // Table headers
    result.armatura.table_headers = await page.evaluate(() => {
      const headers: string[] = [];
      document.querySelectorAll("th, .table-header, [class*='table'] [class*='head']").forEach((el: any) => {
        const text = el.innerText?.trim();
        if (text && text.length < 50) headers.push(text);
      });
      return headers.slice(0, 20);
    });

    // Subcategory chips
    result.armatura.subcategory_chips = await page.evaluate(() => {
      const chips: string[] = [];
      document.querySelectorAll(".tabs a, .chips a, [class*='tab'] a, [class*='chip'], .subcategory a").forEach((el: any) => {
        const text = el.innerText?.trim();
        if (text && text.length < 60) chips.push(text);
      });
      return chips.slice(0, 20);
    });

    // First product link
    result.armatura.first_product_href = await page.evaluate(() => {
      const a = document.querySelector(".product-item a, .catalog-item a, [class*='product'] a, table tbody tr a");
      return (a as any)?.href;
    });

    result.armatura.full_html_sample = await page.evaluate(() => {
      const main = document.querySelector("main, .main-content, #content, .catalog-container");
      return main?.innerHTML?.slice(0, 3000);
    });

  } catch (e: any) {
    result.armatura_error = e.message;
  }

  // ─── 3. Product detail page ───
  console.log("3. Fetching product detail page...");
  const productUrl = result.armatura?.first_product_href || "https://metall-dk.ru/catalog/armatura/armatura-a500s-d12/";
  try {
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    result.product = {};
    result.product.url = page.url();
    result.product.h1 = await page.evaluate(() => document.querySelector("h1")?.innerText?.trim());

    // Price block
    result.product.price_block_html = await page.evaluate(() => {
      const priceBlock = document.querySelector(".price-block, .product-price, [class*='price-block'], [class*='buy-block'], .order-block");
      return priceBlock?.innerHTML?.slice(0, 2000);
    });

    // Price value
    result.product.price_text = await page.evaluate(() => {
      const els = document.querySelectorAll("[class*='price'], [class*='cost']");
      const texts: string[] = [];
      els.forEach((el: any) => { if (el.innerText) texts.push(el.innerText.trim()); });
      return texts.slice(0, 10);
    });

    // Tabs
    result.product.tabs = await page.evaluate(() => {
      const tabs: string[] = [];
      document.querySelectorAll(".tabs [role='tab'], .tab-nav a, [class*='tab-item'], [class*='tabs'] li, .nav-tabs a").forEach((el: any) => {
        const text = el.innerText?.trim();
        if (text && text.length < 40) tabs.push(text);
      });
      return tabs.slice(0, 15);
    });

    // Size buttons
    result.product.size_buttons = await page.evaluate(() => {
      const btns: string[] = [];
      document.querySelectorAll("[class*='size'] button, [class*='variant'] button, [class*='param'] .item, [class*='prop'] .item").forEach((el: any) => {
        const text = el.innerText?.trim();
        if (text && text.length < 30) btns.push(text);
      });
      return btns.slice(0, 20);
    });

    // Calculator block
    result.product.calculator_html = await page.evaluate(() => {
      const calc = document.querySelector("[class*='calc'], .calculator, [class*='order-calc']");
      return calc?.innerHTML?.slice(0, 2000);
    });

    // Specs table (right sidebar)
    result.product.specs = await page.evaluate(() => {
      const specs: Record<string, string> = {};
      document.querySelectorAll(".product-params tr, .specs-table tr, [class*='chars'] tr, [class*='param'] tr, .product-info tr").forEach((tr: any) => {
        const cells = tr.querySelectorAll("td, th");
        if (cells.length >= 2) {
          specs[cells[0].innerText?.trim()] = cells[1].innerText?.trim();
        }
      });
      return specs;
    });

    // Related products
    result.product.related = await page.evaluate(() => {
      const items: string[] = [];
      document.querySelectorAll("[class*='related'] .item, [class*='similar'] .item, [class*='also'] .item, [class*='recom'] .item").forEach((el: any) => {
        items.push(el.innerText?.trim().slice(0, 60));
      });
      return items.slice(0, 10);
    });

    // Full layout structure
    result.product.layout_structure = await page.evaluate(() => {
      const el = document.querySelector(".product-detail, .product-page, [class*='product-card'], main");
      if (!el) return null;
      const getStructure = (node: Element, depth: number): any => {
        if (depth > 3) return null;
        return {
          tag: node.tagName?.toLowerCase(),
          classes: Array.from(node.classList).slice(0, 5).join(" "),
          text: node.children.length === 0 ? (node as any).innerText?.trim().slice(0, 50) : undefined,
          children: depth < 3 ? Array.from(node.children).slice(0, 6).map(c => getStructure(c, depth + 1)).filter(Boolean) : undefined
        };
      };
      return getStructure(el, 0);
    });

    // SEO text structure
    result.product.seo_headings = await page.evaluate(() => {
      const headings: string[] = [];
      document.querySelectorAll("h1, h2, h3").forEach((el: any) => {
        headings.push(`${el.tagName}: ${el.innerText?.trim()}`);
      });
      return headings.slice(0, 20);
    });

  } catch (e: any) {
    result.product_error = e.message;
  }

  // ─── 4. Screenshot for reference ───
  try {
    mkdirSync(join(process.cwd(), "research"), { recursive: true });
    await page.screenshot({ path: join(process.cwd(), "research/product-page.png"), fullPage: false });
    result.screenshot_saved = "research/product-page.png";
  } catch { /* ignore screenshot errors */ }

  await browser.close();

  // Save results
  mkdirSync(join(process.cwd(), "research"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "research/metalldk.json"),
    JSON.stringify(result, null, 2)
  );
  console.log("\nSaved to research/metalldk.json");
  console.log("Tabs found:", result.product?.tabs);
  console.log("Specs found:", Object.keys(result.product?.specs || {}).slice(0, 8));
  console.log("Price text:", result.product?.price_text?.slice(0, 3));
  console.log("Size buttons:", result.product?.size_buttons?.slice(0, 5));
}

main().catch(e => { console.error(e); process.exit(1); });

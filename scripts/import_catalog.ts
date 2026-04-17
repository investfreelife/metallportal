/**
 * Import all products from data/catalog_full.json into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import_catalog.ts
 *   npx tsx scripts/import_catalog.ts --dry-run
 *   npx tsx scripts/import_catalog.ts --limit=100
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* env vars set externally */ }

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPPLIER_ID = "a2000000-0000-0000-0000-000000000001";
const BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CatalogItem {
  article: string;
  category_slug: string;
  full_name: string;
  seo_description: string;
  specs: Record<string, string>;
  unit: string;
  price: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Build category slug → ID index
// ---------------------------------------------------------------------------
async function buildCategoryIndex(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug");
  if (error) throw new Error(`Category fetch failed: ${error.message}`);
  return new Map(data!.map((c) => [c.slug, c.id]));
}

// ---------------------------------------------------------------------------
// Import one batch
// ---------------------------------------------------------------------------
async function importBatch(
  items: CatalogItem[],
  categoryIndex: Map<string, string>,
  dryRun: boolean
): Promise<{ inserted: number; skipped: number; failed: number }> {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Build product rows
  const productRows: any[] = [];
  const priceRows: any[] = [];

  for (const item of items) {
    const categoryId = categoryIndex.get(item.category_slug);
    if (!categoryId) {
      skipped++;
      continue;
    }

    const productId = randomUUID();
    const slug = item.article.toLowerCase();

    productRows.push({
      id: productId,
      name: item.full_name,
      slug,
      category_id: categoryId,
      supplier_id: SUPPLIER_ID,
      description: item.seo_description,
      unit: item.unit,
      gost: item.specs?.["ГОСТ"] || null,
      steel_grade: item.specs?.["Марка стали"] || null,
      article: item.article,
      is_active: true,
    });

    priceRows.push({
      id: randomUUID(),
      product_id: productId,
      supplier_id: SUPPLIER_ID,
      base_price: item.price,
      discount_price: Math.round(item.price * 1.08 * 100) / 100,
      in_stock: true,
      stock_quantity: 1000,
    });
  }

  if (dryRun) {
    console.log(`  [DRY] Would insert ${productRows.length} products + ${priceRows.length} prices`);
    return { inserted: productRows.length, skipped, failed: 0 };
  }

  // Insert products
  const { error: pErr, count: pCount } = await supabase
    .from("products")
    .upsert(productRows, { onConflict: "slug", ignoreDuplicates: true, count: "exact" });

  if (pErr) {
    console.error(`  ✗ Products error: ${pErr.message}`);
    return { inserted: 0, skipped, failed: productRows.length };
  }

  // Insert price items
  const { error: piErr } = await supabase
    .from("price_items")
    .upsert(priceRows, { onConflict: "id", ignoreDuplicates: true });

  if (piErr) {
    console.error(`  ✗ Price items error: ${piErr.message}`);
    // Products were inserted, prices failed
    return { inserted: pCount ?? productRows.length, skipped, failed: priceRows.length };
  }

  inserted = pCount ?? productRows.length;
  return { inserted, skipped, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, v] = a.slice(2).split("=");
        return [k, v ?? "true"];
      })
  );

  const dryRun = args["dry-run"] === "true";
  const limit = args.limit ? parseInt(args.limit) : undefined;

  console.log("═══════════════════════════════════════════════════");
  console.log("  МеталлПортал — Catalog Import");
  console.log("═══════════════════════════════════════════════════\n");

  if (dryRun) console.log("🔍 DRY RUN — nothing will be written to DB\n");

  // 1. Load JSON
  console.log("Loading data/catalog_full.json...");
  const raw = readFileSync(join(process.cwd(), "data/catalog_full.json"), "utf-8");
  let items: CatalogItem[] = JSON.parse(raw);
  console.log(`  ${items.length} items loaded`);

  if (limit) {
    items = items.slice(0, limit);
    console.log(`  Limited to ${items.length} items`);
  }

  // 2. Build category index
  console.log("\nBuilding category index...");
  const categoryIndex = await buildCategoryIndex();
  console.log(`  ${categoryIndex.size} categories`);

  // Check for missing categories
  const missing = new Set<string>();
  for (const item of items) {
    if (!categoryIndex.has(item.category_slug)) {
      missing.add(item.category_slug);
    }
  }
  if (missing.size > 0) {
    console.warn(`  ⚠ Missing categories: ${[...missing].join(", ")}`);
  }

  // 3. Note: TRUNCATE products/price_items before running this script
  //    via: supabase db query "TRUNCATE price_items CASCADE; TRUNCATE products CASCADE;"

  // 4. Process in batches
  const total = items.length;
  const batchCount = Math.ceil(total / BATCH_SIZE);
  console.log(`\nImporting ${total} products in ${batchCount} batches of ${BATCH_SIZE}\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = items.slice(i, i + BATCH_SIZE);

    const { inserted, skipped, failed } = await importBatch(batch, categoryIndex, dryRun);
    totalInserted += inserted;
    totalSkipped += skipped;
    totalFailed += failed;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = ((i + batch.length) / total * 100).toFixed(0);
    process.stdout.write(
      `  Batch ${batchNum}/${batchCount}: +${inserted} | ${pct}% | ${elapsed}s` +
      (skipped ? ` (${skipped} skipped)` : "") +
      (failed ? ` (${failed} FAILED)` : "") +
      "\n"
    );
  }

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(55)}`);
  console.log(`Done in ${elapsed}s`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped:  ${totalSkipped}`);
  console.log(`  Failed:   ${totalFailed}`);
  console.log(`  Total:    ${total}`);
  console.log(`${"═".repeat(55)}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

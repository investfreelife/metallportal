/**
 * Reindex all products to correct categories based on data/catalog_full.json.
 * Matches products by article field, updates category_id.
 *
 * Usage: npx tsx scripts/reindex_categories.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local
try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()])
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CatalogItem {
  article: string;
  category_slug: string;
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  МеталлПортал — Category Reindex");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Load catalog
  console.log("Loading data/catalog_full.json...");
  const items: CatalogItem[] = JSON.parse(
    readFileSync(join(process.cwd(), "data/catalog_full.json"), "utf-8")
  );
  console.log(`  ${items.length} items\n`);

  // 2. Build category slug → id map
  console.log("Loading categories...");
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, slug");
  if (catErr) throw new Error(`Category fetch: ${catErr.message}`);
  const slugToId = new Map(cats!.map((c) => [c.slug, c.id]));
  console.log(`  ${slugToId.size} categories\n`);

  // Check for missing slugs in DB
  const missingSlugs = new Set<string>();
  for (const item of items) {
    if (!slugToId.has(item.category_slug)) missingSlugs.add(item.category_slug);
  }
  if (missingSlugs.size > 0) {
    console.warn(`  ⚠ Missing category slugs in DB: ${[...missingSlugs].join(", ")}`);
  }

  // 3. Load all products (article → id, category_id)
  console.log("Loading products...");
  const allProducts: { id: string; article: string; category_id: string }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, article, category_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Products fetch: ${error.message}`);
    if (!data || data.length === 0) break;
    allProducts.push(...data);
    from += data.length;
    if (data.length < PAGE) break;
  }
  console.log(`  ${allProducts.length} products loaded\n`);

  // Build article → product map
  const articleToProduct = new Map(
    allProducts
      .filter((p) => p.article)
      .map((p) => [p.article, { id: p.id, category_id: p.category_id }])
  );

  // 4. Calculate updates
  console.log("Calculating updates...");
  const updates: { id: string; category_id: string }[] = [];
  let matched = 0;
  let noProduct = 0;
  let noCategory = 0;
  let alreadyCorrect = 0;

  for (const item of items) {
    const product = articleToProduct.get(item.article);
    if (!product) {
      noProduct++;
      continue;
    }

    const correctCategoryId = slugToId.get(item.category_slug);
    if (!correctCategoryId) {
      noCategory++;
      continue;
    }

    matched++;
    if (product.category_id === correctCategoryId) {
      alreadyCorrect++;
    } else {
      updates.push({ id: product.id, category_id: correctCategoryId });
    }
  }

  console.log(`  Matched: ${matched}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Need update: ${updates.length}`);
  console.log(`  No product found: ${noProduct}`);
  console.log(`  No category found: ${noCategory}\n`);

  if (updates.length === 0) {
    console.log("Nothing to update!");
    return;
  }

  // 5. Apply updates in batches
  console.log(`Applying ${updates.length} updates...\n`);
  const BATCH = 200;
  let applied = 0;
  let failed = 0;

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);

    // Supabase doesn't have bulk update with different values, so do individual updates
    // Group by category_id for efficiency
    const byCat = new Map<string, string[]>();
    for (const u of batch) {
      const arr = byCat.get(u.category_id) || [];
      arr.push(u.id);
      byCat.set(u.category_id, arr);
    }

    for (const [catId, productIds] of byCat) {
      const { error } = await supabase
        .from("products")
        .update({ category_id: catId })
        .in("id", productIds);

      if (error) {
        console.error(`  ✗ Error updating ${productIds.length} products to ${catId}: ${error.message}`);
        failed += productIds.length;
      } else {
        applied += productIds.length;
      }
    }

    const pct = Math.round(((i + batch.length) / updates.length) * 100);
    process.stdout.write(`  ${pct}% (${applied} updated, ${failed} failed)\r`);
  }

  console.log(`\n\nDone: ${applied} updated, ${failed} failed\n`);

  // 6. Verify — count by category
  console.log("Verifying category counts...\n");
  const { data: counts } = await supabase.rpc("get_category_counts" as any);
  // Fallback: manual count
  const expectedSlugs = [
    "truby-vgp", "truby-besshovnye", "truby-es", "truby-ocinkovanye",
    "armatura-a500", "armatura-a240", "list-gk", "prof-okrash", "prof-ocink",
    "nerzhaveika", "alyuminij", "med-latun", "metizy-krepezh",
    "kachestvennyj", "inzhenernye", "shveller",
    "ankery", "zadvizhki", "krany", "flancy", "shpilki", "bolty-gajki",
  ];

  let totalVerified = 0;
  for (const slug of expectedSlugs) {
    const catId = slugToId.get(slug);
    if (!catId) continue;
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", catId);
    if (count && count > 0) {
      console.log(`  ${slug}: ${count}`);
      totalVerified += count;
    }
  }
  console.log(`  ───────────────────`);
  console.log(`  TOTAL: ${totalVerified}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

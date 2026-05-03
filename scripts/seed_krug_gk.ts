/**
 * Seed для 5 L3 категорий круга г/к (W2-15) — самый крупный phase.
 *
 * Один источник раздел "Круг г/к" разносит 781 SKU по 5 L3 категориям
 * через name-pattern classifier (см. parse_krug_gk.py classify()).
 *
 * Source: scripts/data/krug_gk_skus.json (генерится из
 * scripts/data/krug_gk_raw.txt через scripts/parse_krug_gk.py).
 * 783 raw rows → 781 unique SKU после dedup (2 dedup-events).
 *
 * Distribution:
 *   krug-konstruktsionnyy        → 433 SKU
 *   krug-nerzhaveyuschiy-nikel   → 166 SKU
 *   krug-zharoprochnyy           → 142 SKU
 *   krug-instrumentalnyy         →  32 SKU
 *   krug-otsinkovannyy-gk        →   8 SKU
 *
 * ADR-0013 НЕ применяется (single-unit, обе ценовые колонки за тонну).
 *
 * Длина для всех = NULL (source: пустая колонка для всего раздела).
 *
 * Backup: scripts/data/_backup_products_pre_w2-15_*.json (878 rows
 * предыдущих products перед --commit).
 *
 * Idempotency: SELECT slug → INSERT only if missing.
 *
 * Usage:
 *   npx tsx scripts/seed_krug_gk.ts             # dry-run
 *   npx tsx scripts/seed_krug_gk.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

// L3 category ids — auto-resolved через REST после migration 20260510000000.
// UUID-ы взяты из Supabase post-migration (выводим через
// `gh api ... | jq` если нужно перепроверить).
const CATEGORY_IDS: Record<string, string> = {
  konstruktsionnyy: "1e06974a-8c7c-41a2-9b64-56a276dcc930", // krug-konstruktsionnyy
  nerzhaveyuschiy: "72a73cd2-fedc-425f-82e3-8f5ac329048f", // krug-nerzhaveyuschiy-nikel
  zharoprochnyy: "638404e4-5a49-4954-a663-fa64f8f945e7", // krug-zharoprochnyy
  instrumentalnyy: "e2446123-344d-4385-adf1-f638a9cf503a", // krug-instrumentalnyy
  otsinkovannyy: "d9a832b4-5eef-47d6-87f1-74dd9d2ed3bb", // krug-otsinkovannyy-gk
};

const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т";

type ParsedSku = {
  name: string;
  slug: string;
  category: keyof typeof CATEGORY_IDS;
  size: number;
  is_ocink: boolean;
  modifiers: string[];
  is_k: boolean;
  steel_grade: string;
  grade_canonical: string;
  length: number | null;
  length_options: string[];
  base_price: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "krug_gk_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null;
  steel_grade: string | null;
  coating: string | null;
  length: number | null;
  length_options: string[];
  unit: string;
  is_active: boolean;
  min_order: number;
};

type PriceRow = {
  product_id: string;
  supplier_id: string;
  base_price: number;
  markup_pct: number;
  currency: string;
  min_quantity: number;
  in_stock: boolean;
  unit: string;
};

function buildProduct(sku: ParsedSku): ProductRow {
  const category_id = CATEGORY_IDS[sku.category];
  if (!category_id) throw new Error(`No category_id for ${sku.category}`);
  return {
    name: sku.name,
    slug: sku.slug,
    category_id,
    diameter: sku.size,
    steel_grade: sku.steel_grade,
    coating: sku.is_ocink ? "оцинкованный" : null,
    length: sku.length,
    length_options: sku.length_options,
    unit: UNIT,
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_krug_gk.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);

  console.log(`${products.length} SKU loaded; expecting same number price_items (single-unit)`);

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  const splitCount: Record<string, number> = {};
  for (const s of skus) splitCount[s.category] = (splitCount[s.category] || 0) + 1;
  console.log("Distribution:");
  for (const [cat, count] of Object.entries(splitCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(20)} → ${String(count).padStart(4)} SKU → ${CATEGORY_IDS[cat]}`);
  }

  if (!isCommit) {
    console.log(`\nDry-run complete. Re-run with --commit.\n`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  let productsInserted = 0,
    productsSkipped = 0,
    pricesInserted = 0,
    pricesSkipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const sku = skus[i];

    // Progress (every 100 SKU).
    if (i > 0 && i % 100 === 0) {
      console.log(`  ... ${i}/${products.length} processed (inserted ${productsInserted}, skipped ${productsSkipped})`);
    }

    const { data: existing, error: selErr } = await supabase
      .from("products")
      .select("id")
      .eq("slug", p.slug)
      .maybeSingle();
    if (selErr) {
      errors.push(`[${p.slug}] select: ${selErr.message}`);
      continue;
    }

    let productId: string;
    if (existing) {
      productId = existing.id;
      productsSkipped++;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("products")
        .insert(p)
        .select("id")
        .single();
      if (insErr || !ins) {
        errors.push(`[${p.slug}] insert: ${insErr?.message ?? "no row"}`);
        continue;
      }
      productId = ins.id;
      productsInserted++;
    }

    const { data: existingPrice, error: pSelErr } = await supabase
      .from("price_items")
      .select("id")
      .eq("product_id", productId)
      .eq("supplier_id", SUPPLIER_ID)
      .eq("unit", UNIT)
      .maybeSingle();
    if (pSelErr) {
      errors.push(`[${p.slug}] price select: ${pSelErr.message}`);
      continue;
    }

    if (existingPrice) {
      pricesSkipped++;
      continue;
    }

    const priceRow: PriceRow = {
      product_id: productId,
      supplier_id: SUPPLIER_ID,
      base_price: sku.base_price,
      markup_pct: MARKUP_PCT,
      currency: CURRENCY,
      min_quantity: 1.0,
      in_stock: true,
      unit: UNIT,
    };
    const { error: pInsErr } = await supabase.from("price_items").insert(priceRow);
    if (pInsErr) {
      errors.push(`[${p.slug}] insert price: ${pInsErr.message}`);
      continue;
    }
    pricesInserted++;
  }

  console.log("\n=== Commit summary ===");
  console.log(`  products inserted:  ${productsInserted}`);
  console.log(`  products skipped:   ${productsSkipped} (already existed)`);
  console.log(`  price_items added:  ${pricesInserted}`);
  console.log(`  price_items kept:   ${pricesSkipped} (already existed)`);
  if (errors.length > 0) {
    console.log(`\n  ❌ ${errors.length} errors:`);
    errors.slice(0, 10).forEach((e) => console.log(`     ${e}`));
    if (errors.length > 10) console.log(`     ... +${errors.length - 10} more`);
    process.exit(1);
  }
  console.log("\n  ✅ all rows processed cleanly");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

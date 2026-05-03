/**
 * Seed для проволоки (W2-16) — 6 L3-категорий из одного источника.
 *
 * Source: scripts/data/provoloka_skus.json (генерится из
 * scripts/data/provoloka_raw.txt через scripts/parse_provoloka.py).
 * 168 raw rows → 161 unique SKUs (7 dedup events: 6× ВР-1 ГОСТ
 * d=3,4,5 collapsed + 1× nerzh d=1).
 *
 * Распределение по L3 (section_slug → category_id):
 *   provoloka-alyuminievaya              →   6 SKU (АД1 implicit)
 *   provoloka-nikhromovaya               →   9 SKU (MULTI-UNIT ₽/кг + ₽/т)
 *   provoloka-vysokoe-soprotivlenie      →   2 SKU (Х27Ю5Т implicit)
 *   provoloka-nerzhaveyuschaya           → 105 SKU (multi-grade keep)
 *   provoloka-pruzhinnaya                →  24 SKU (NULL ГОСТ 9389 + 60С2А ГОСТ 14963)
 *   provoloka-vr-1                       →  15 SKU (NULL grade — gost/tu mod)
 *   ──────────────────────────────────────────────
 *   Total                                  161 products + 170 price_items
 *      (155 single-unit ₽/т + 9 multi-unit nikh × 2 = 18 → 9*2=18, 152*1=152, 9*2=18 = 170)
 *      Точная разбивка: 152 single-unit (т) + 9 multi-unit (т+кг) = 152 + 18 = 170.
 *
 * Multi-unit pricing (ADR-0013): only nikh секция creates 2 price_items
 * per product (unit="кг" + unit="т"). Остальные секции — 1 price_item
 * (unit="т"), даже если price_1 != price_2 (volume-tier — берём min).
 *
 * Slug fixed token order (KB ext, decimal-size `p`):
 *   provoloka-{short}-{D-with-p}-[mods alphabetical]-[grade]-nd
 *
 * Idempotency key: (product_id, supplier_id, unit) — multi-unit-aware.
 *
 * Usage:
 *   npx tsx scripts/seed_provoloka.ts             # dry-run
 *   npx tsx scripts/seed_provoloka.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_BY_SECTION: Record<string, string> = {
  "provoloka-alyuminievaya":         "54f84552-68ca-459f-8a62-1009ebcd89d0",
  "provoloka-nikhromovaya":          "9333ede9-d50c-45da-9d70-0e1c2c603a8a",
  "provoloka-vysokoe-soprotivlenie": "32a48ca6-2c7c-4657-9fb3-7cf96becd627",
  "provoloka-nerzhaveyuschaya":      "aa543c9e-b706-4792-9954-f57b4e3ff02d",
  "provoloka-pruzhinnaya":           "e8bfec08-c7fe-4e98-8485-b9d799fe1f24",
  "provoloka-vr-1":                  "3785d650-b593-4bf1-ae45-36e65ed8140c",
};

const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT_TON = "т";
const UNIT_KG = "кг";

type ParsedSku = {
  name: string;
  slug: string;
  section_slug: string;
  section_short: string;
  size_raw: string;
  size_num: number;
  size_token: string;
  modifiers: string[];
  steel_grade: string | null;
  grade_canonical: string | null;
  length: number | null;
  length_options: string[];
  multi_unit: boolean;
  price_per_ton: number;
  price_per_kg: number | null;
  base_price: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "provoloka_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null; // size в мм (decimal)
  steel_grade: string | null;
  length: number | null;
  length_options: string[];
  unit: string;
  is_active: boolean;
  min_order: number;
};

function buildProduct(sku: ParsedSku): ProductRow {
  const category_id = CATEGORY_BY_SECTION[sku.section_slug];
  if (!category_id) throw new Error(`No category mapping for section: ${sku.section_slug}`);
  return {
    name: sku.name,
    slug: sku.slug,
    category_id,
    diameter: sku.size_num, // мм (NUMERIC; subсм-размеры тоже decimal)
    steel_grade: sku.steel_grade,
    length: sku.length,
    length_options: sku.length_options,
    unit: UNIT_TON, // primary unit для cart
    is_active: true,
    min_order: 1.0,
  };
}

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

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_provoloka.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);

  // Sanity: slug uniqueness.
  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision: ${products.length} products vs ${slugSet.size} unique slugs`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique`);

  // Distribution.
  const splitCount: Record<string, number> = {};
  for (const s of skus) splitCount[s.section_slug] = (splitCount[s.section_slug] || 0) + 1;
  console.log(`\nDistribution (section → count → category_id):`);
  for (const [sec, n] of Object.entries(splitCount)) {
    console.log(`  ${sec.padEnd(36)} → ${String(n).padStart(4)} SKU → ${CATEGORY_BY_SECTION[sec]}`);
  }

  const multiUnitCount = skus.filter((s) => s.multi_unit).length;
  const singleUnitCount = skus.length - multiUnitCount;
  const expectedPriceItems = singleUnitCount + multiUnitCount * 2;
  console.log(
    `\nExpected price_items: ${singleUnitCount} (single-unit) + ${multiUnitCount}×2 (multi-unit) = ${expectedPriceItems}`,
  );

  console.log("\nFirst 5 SKUs из каждой секции:");
  const seen = new Set<string>();
  let shown = 0;
  for (const sku of skus) {
    if (shown >= 12) break;
    if (seen.has(sku.section_short)) continue;
    seen.add(sku.section_short);
    const ppk = sku.price_per_kg !== null ? `${sku.price_per_kg.toFixed(0)} ₽/кг + ` : "";
    console.log(
      `  ${sku.section_short.padEnd(6)} | ${sku.name.padEnd(60).slice(0, 60)} | ` +
        `${(sku.steel_grade ?? "—").padEnd(28).slice(0, 28)} | ` +
        `${ppk}${sku.price_per_ton.toLocaleString("ru-RU").padStart(10)} ₽/т | ${sku.slug}`,
    );
    shown++;
  }

  if (!isCommit) {
    console.log(`\nDry-run complete.\n`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
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

    // price_items: single-unit (т) или multi-unit (т + кг)
    const priceUnits: Array<[string, number]> = [
      [UNIT_TON, sku.price_per_ton],
    ];
    if (sku.multi_unit && sku.price_per_kg !== null) {
      priceUnits.push([UNIT_KG, sku.price_per_kg]);
    }

    for (const [unit, base_price] of priceUnits) {
      const { data: existingPrice, error: pSelErr } = await supabase
        .from("price_items")
        .select("id")
        .eq("product_id", productId)
        .eq("supplier_id", SUPPLIER_ID)
        .eq("unit", unit)
        .maybeSingle();
      if (pSelErr) {
        errors.push(`[${p.slug}/${unit}] price select: ${pSelErr.message}`);
        continue;
      }

      if (existingPrice) {
        pricesSkipped++;
        continue;
      }

      const priceRow: PriceRow = {
        product_id: productId,
        supplier_id: SUPPLIER_ID,
        base_price,
        markup_pct: MARKUP_PCT,
        currency: CURRENCY,
        min_quantity: 1.0,
        in_stock: true,
        unit,
      };
      const { error: pInsErr } = await supabase.from("price_items").insert(priceRow);
      if (pInsErr) {
        errors.push(`[${p.slug}/${unit}] insert price: ${pInsErr.message}`);
        continue;
      }
      pricesInserted++;
    }
  }

  console.log("\n=== Commit summary ===");
  console.log(`  products inserted:  ${productsInserted}`);
  console.log(`  products skipped:   ${productsSkipped} (already existed)`);
  console.log(`  price_items added:  ${pricesInserted}  (multi-unit nikh = 2 per product)`);
  console.log(`  price_items kept:   ${pricesSkipped} (already existed)`);
  if (errors.length > 0) {
    console.log(`\n  ❌ ${errors.length} errors:`);
    errors.forEach((e) => console.log(`     ${e}`));
    process.exit(1);
  }
  console.log("\n  ✅ all rows processed cleanly");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

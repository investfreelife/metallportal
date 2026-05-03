/**
 * Seed для категории `shveller-nizkolegirovannyy` (W2-10).
 *
 * Источник: scripts/data/shveller_nl_skus.json. 32 raw rows → 32 unique
 * SKU (нет дублей).
 *
 * Категория `shveller-nizkolegirovannyy` (id 337e4582-...,
 * child of balka-shveller, sort_order=6).
 *
 * Особенности:
 * - 4 steel_grade: С355=18, 09Г2С-15=12, С345=1, 09Г2С-14=1
 * - 2 типа: П=19, У=13 (Б/Ш-серий нет — только горячекатаные П/У)
 * - All lengths = 12000
 * - ADR-0013 НЕ применяется (обе ценовые колонки за тонну)
 *
 * Финальный phase в цепочке балка-швеллер импорта (W2-6..W2-10).
 *
 * Usage:
 *   npx tsx scripts/seed_shveller_nl.ts             # dry-run
 *   npx tsx scripts/seed_shveller_nl.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "337e4582-7534-4a70-9338-19400c01f439"; // shveller-nizkolegirovannyy
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т";

type ParsedSku = {
  name: string;
  slug: string;
  size: number;
  type: string;
  steel_grade: string;
  length: number;
  length_options: string[];
  base_price: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "shveller_nl_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null;
  steel_grade: string;
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
  return {
    name: sku.name,
    slug: sku.slug,
    category_id: CATEGORY_ID,
    diameter: sku.size,
    steel_grade: sku.steel_grade,
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
  console.log(`\n=== seed_shveller_nl.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);
  console.log(`${products.length} SKU loaded`);
  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  console.log("First 5 SKUs:");
  for (let i = 0; i < Math.min(5, products.length); i++) {
    const p = products[i];
    const sku = skus[i];
    console.log(
      `  ${String(i + 1).padStart(2)} | ${p.name.padEnd(40)} | ${p.steel_grade.padEnd(12)} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} ₽/т | ${p.slug}`,
    );
  }

  if (!isCommit) {
    console.log(`\nDry-run complete.\n`);
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
    errors.forEach((e) => console.log(`     ${e}`));
    process.exit(1);
  }
  console.log("\n  ✅ all rows processed cleanly");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

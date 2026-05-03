/**
 * Seed для категории `balki-dvutavr-nizkolegirovannye` (W2-7).
 *
 * Источник: scripts/data/balki_nl_skus.json (генерится из
 * scripts/data/balki_nl_raw.txt через scripts/parse_balki_nl.py).
 * 81 raw rows → 80 unique SKU после dedup.
 *
 * Категория `balki-dvutavr-nizkolegirovannye` (id ade0f987-...,
 * child of balka-shveller, sort_order=2).
 *
 * ADR-0013 (multi-unit pricing) НЕ применяется: source имеет только
 * "руб 1-5т" и "руб 5-10т" (обе за тонну). 1:1 product:price_item, unit="т".
 *
 * Идемпотентность: SELECT slug → INSERT only if missing.
 *
 * Usage:
 *   npx tsx scripts/seed_balki_nl.ts             # dry-run (default)
 *   npx tsx scripts/seed_balki_nl.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "ade0f987-f9d8-4c82-874d-bc713eeba54c"; // balki-dvutavr-nizkolegirovannye
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т";

type ParsedSku = {
  name: string;
  slug: string;
  size: number;
  series: string | null;
  steel_grade: string;
  length: number | null;
  length_options: string[];
  base_price: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "balki_nl_skus.json");
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
  const mode = isCommit ? "COMMIT (will write to DB)" : "DRY-RUN (no writes)";

  console.log(`\n=== seed_balki_nl.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);

  console.log(`${products.length} SKU loaded from balki_nl_skus.json`);

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(
      `\n❌ Slug collision: ${products.length} SKUs but only ${slugSet.size} unique`,
    );
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  console.log("First 5 SKUs:");
  for (let i = 0; i < Math.min(5, products.length); i++) {
    const p = products[i];
    const sku = skus[i];
    const len = (p.length ?? "н/д").toString().padStart(5);
    console.log(
      `  ${String(i + 1).padStart(3)} | ${p.name.padEnd(28)} | ` +
        `${p.steel_grade.padEnd(10)} | len ${len} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} ₽/т | ${p.slug}`,
    );
  }
  console.log("...");
  console.log("Last 3 SKUs:");
  for (let i = Math.max(0, products.length - 3); i < products.length; i++) {
    const p = products[i];
    const sku = skus[i];
    const len = (p.length ?? "н/д").toString().padStart(5);
    console.log(
      `  ${String(i + 1).padStart(3)} | ${p.name.padEnd(28)} | ` +
        `${p.steel_grade.padEnd(10)} | len ${len} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} ₽/т | ${p.slug}`,
    );
  }

  if (!isCommit) {
    console.log(`\nDry-run complete. Re-run with --commit to insert into database.\n`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  let productsInserted = 0;
  let productsSkipped = 0;
  let pricesInserted = 0;
  let pricesSkipped = 0;
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
        errors.push(`[${p.slug}] insert product: ${insErr?.message ?? "no row"}`);
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

/**
 * Seed для категории `balki-dvutavr` (W2-6).
 *
 * Источник данных: scripts/data/balki_dvutavr_skus.json (генерится из
 * scripts/data/balki_dvutavr_raw.txt через scripts/parse_balki_dvutavr.py).
 * Dedup + min-aggregation цены — на стороне парсера; этот скрипт просто
 * INSERT'ит готовые SKU.
 *
 * Категория `balki-dvutavr` (id 9652914a-..., child of balka-shveller).
 *
 * ADR-0013 (multi-unit pricing) НЕ применяется: source не имеет колонки
 * "руб/м", обе цены ("1-5т" / "5-10т") за тонну. → 1:1 product:price_item
 * с unit="т".
 *
 * Идемпотентность: SELECT slug → INSERT only if missing для products,
 * SELECT (product_id, supplier_id) → INSERT only if missing для price_items.
 *
 * Usage:
 *   npx tsx scripts/seed_balki_dvutavr.ts             # dry-run (default)
 *   npx tsx scripts/seed_balki_dvutavr.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "9652914a-ab4a-4557-8253-5b1aca4b6ac4"; // balki-dvutavr
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
  gost: string;
  length: number | null;
  length_options: string[];
  base_price: number;
  _dedup_count: number;
  _all_prices: number[];
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "balki_dvutavr_skus.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as ParsedSku[];
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
  gost: string;
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
    // diameter в schema используется и для Ø (катанка), и для номинального
    // размера двутавра — пишем туда `size` (10/12/.../70). Не идеально
    // семантически, но иначе пришлось бы тащить ещё одну колонку.
    diameter: sku.size,
    steel_grade: sku.steel_grade,
    length: sku.length,
    length_options: sku.length_options,
    unit: UNIT,
    is_active: true,
    min_order: 1.0,
    gost: sku.gost,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT (will write to DB)" : "DRY-RUN (no writes)";

  console.log(`\n=== seed_balki_dvutavr.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);

  console.log(`${products.length} SKU loaded from balki_dvutavr_skus.json\n`);

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(
      `\n❌ Slug collision: ${products.length} SKUs but only ${slugSet.size} unique`,
    );
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique`);

  // Print first few + last few для visual sanity.
  const peek = (arr: ProductRow[], n: number) =>
    arr.map((p, i) => {
      const sku = skus[i];
      const len = (p.length ?? "н/д").toString().padStart(5);
      return (
        `  ${String(i + 1).padStart(3)} | ${p.name.padEnd(20)} | ` +
        `${p.steel_grade.padEnd(10)} | len ${len} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} ₽/т | ${p.slug}`
      );
    });

  console.log("\nFirst 5 SKUs:");
  console.log(peek(products.slice(0, 5), 5).join("\n"));
  console.log("...");
  console.log("Last 5 SKUs:");
  const tail = products.slice(-5);
  tail.forEach((_, i) => {
    const idx = products.length - 5 + i;
    const sku = skus[idx];
    const p = products[idx];
    const len = (p.length ?? "н/д").toString().padStart(5);
    console.log(
      `  ${String(idx + 1).padStart(3)} | ${p.name.padEnd(20)} | ` +
        `${p.steel_grade.padEnd(10)} | len ${len} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} ₽/т | ${p.slug}`,
    );
  });

  if (!isCommit) {
    console.log(`\nDry-run complete. Re-run with --commit to insert into database.\n`);
    return;
  }

  // === COMMIT path ===
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

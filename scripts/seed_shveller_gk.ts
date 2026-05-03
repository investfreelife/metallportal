/**
 * Seed для категории `shveller-goryachekatanyy` (W2-8).
 *
 * ПЕРВЫЙ seed с применением ADR-0013 (multi-unit pricing): на каждый
 * product создаём 2 price_items — unit="м" (price_per_meter) + unit="т"
 * (price_per_ton). UI ProductTable.tsx показывает primary (₽/т) большим
 * шрифтом и secondary (₽/м) мелким subtext.
 *
 * Источник: scripts/data/shveller_gk_skus.json (генерится из
 * scripts/data/shveller_gk_raw.txt через scripts/parse_shveller_gk.py).
 * 64 raw rows → 62 unique SKU после dedup (2 dedup-events).
 *
 * Категория `shveller-goryachekatanyy` (id ea65065b-..., child of
 * balka-shveller, sort_order=4).
 *
 * Идемпотентность:
 *   - products: SELECT slug → INSERT only if missing
 *   - price_items: SELECT (product_id, supplier_id, unit) → INSERT only if missing
 *     (NOTE: ключ idempotency расширен `unit` для multi-unit; в seed_armatura_*
 *      ключ был только (product_id, supplier_id))
 *
 * Usage:
 *   npx tsx scripts/seed_shveller_gk.ts             # dry-run (default)
 *   npx tsx scripts/seed_shveller_gk.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "ea65065b-f8e0-4144-8af4-4762aae36302"; // shveller-goryachekatanyy
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT_METER = "м";
const UNIT_TON = "т";

type ParsedSku = {
  name: string;
  slug: string;
  size: number;
  type: string; // П / У
  steel_grade: string;
  length: number;
  length_options: string[];
  price_per_meter: number;
  price_per_ton: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "shveller_gk_skus.json");
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
    // diameter в schema используется как номинальный размер.
    diameter: sku.size,
    steel_grade: sku.steel_grade,
    length: sku.length,
    length_options: sku.length_options,
    // products.unit — primary единица для cart (за тонну как в balki).
    unit: UNIT_TON,
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT (will write to DB)" : "DRY-RUN (no writes)";

  console.log(`\n=== seed_shveller_gk.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);

  console.log(`${products.length} SKU loaded; expecting ${products.length * 2} price_items (multi-unit ADR-0013)`);

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(
      `\n❌ Slug collision: ${products.length} SKUs but only ${slugSet.size} unique`,
    );
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  console.log("First 5 SKUs (multi-unit pricing):");
  for (let i = 0; i < Math.min(5, products.length); i++) {
    const p = products[i];
    const sku = skus[i];
    console.log(
      `  ${String(i + 1).padStart(3)} | ${p.name.padEnd(20)} | ` +
        `${p.steel_grade.padEnd(8)} | len ${p.length} | ` +
        `${sku.price_per_meter.toLocaleString("ru-RU").padStart(6)} ₽/м + ` +
        `${sku.price_per_ton.toLocaleString("ru-RU").padStart(8)} ₽/т | ${p.slug}`,
    );
  }

  if (!isCommit) {
    console.log(`\nDry-run complete. Re-run with --commit.\n`);
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

    // 1. Product (idempotent через slug).
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

    // 2. Two price_items (multi-unit). Idempotent через (product_id, supplier_id, unit).
    for (const [unit, base_price] of [
      [UNIT_METER, sku.price_per_meter],
      [UNIT_TON, sku.price_per_ton],
    ] as Array<[string, number]>) {
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
  console.log(`  price_items added:  ${pricesInserted}  (multi-unit: 2 per product)`);
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

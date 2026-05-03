/**
 * Seed для категории `ugolok-nerzhaveyuschiy-nikelsoderzhaschiy` (W2-13).
 *
 * ПЕРВЫЙ 3-unit pricing case (B+ hybrid согласовано в чате):
 *   - Source имеет 3 ценовые колонки: руб/шт + руб/м + руб/(0.1-1т)
 *   - Seed создаёт 3 price_items на product (unit="т", "м", "шт")
 *   - UI ProductTable.tsx (расширен в этом PR) рендерит top-2 по
 *     UNIT_PRIORITY = ['т', 'м', 'шт', 'кг']
 *   - Для нержавейки top-2 = ₽/т (primary) + ₽/м (secondary). ₽/шт
 *     лежит в БД для будущего использования (не показывается).
 *
 * Источник: scripts/data/ugolok_nrz_skus.json (генерится из
 * scripts/data/ugolok_nrz_raw.txt через scripts/parse_ugolok_nrz.py).
 * 20 raw rows → 20 unique SKU (нет дублей).
 *
 * Категория `ugolok-nerzhaveyuschiy-nikelsoderzhaschiy` (id 56262262-...,
 * child of ugolok, sort_order=4).
 *
 * Idempotency key: (product_id, supplier_id, unit) — расширен `unit`
 * для multi-unit (как в W2-8).
 *
 * Usage:
 *   npx tsx scripts/seed_ugolok_nrz.ts             # dry-run
 *   npx tsx scripts/seed_ugolok_nrz.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "56262262-2e3b-430f-a67a-c46fc6998d8d"; // ugolok-nerzhaveyuschiy-nikelsoderzhaschiy
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT_PIECE = "шт";
const UNIT_METER = "м";
const UNIT_TON = "т";

type ParsedSku = {
  name: string;
  slug: string;
  size: number;
  thickness: number;
  steel_grade: string;
  length: number;
  length_options: string[];
  price_per_piece: number;
  price_per_meter: number;
  price_per_ton: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "ugolok_nrz_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null;
  thickness: number | null;
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
    thickness: sku.thickness,
    steel_grade: sku.steel_grade,
    length: sku.length,
    length_options: sku.length_options,
    // products.unit — primary (за тонну, как в W2-8 multi-unit pattern).
    unit: UNIT_TON,
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_ugolok_nrz.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);
  console.log(
    `${products.length} SKU loaded; expecting ${products.length * 3} price_items (3-unit ADR-0013)`,
  );

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  console.log("First 5 SKUs (3-unit pricing):");
  for (let i = 0; i < Math.min(5, products.length); i++) {
    const p = products[i];
    const sku = skus[i];
    console.log(
      `  ${String(i + 1).padStart(2)} | ${p.name.padEnd(50)} | ${p.steel_grade.padEnd(20)} | ` +
        `${sku.price_per_ton.toLocaleString("ru-RU").padStart(8)} ₽/т + ` +
        `${sku.price_per_meter.toLocaleString("ru-RU").padStart(5)} ₽/м + ` +
        `${sku.price_per_piece.toLocaleString("ru-RU").padStart(7)} ₽/шт | ${p.slug}`,
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

    // 3 price_items: т + м + шт. Idempotent ключ (product_id, supplier_id, unit).
    for (const [unit, base_price] of [
      [UNIT_TON, sku.price_per_ton],
      [UNIT_METER, sku.price_per_meter],
      [UNIT_PIECE, sku.price_per_piece],
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
  console.log(`  price_items added:  ${pricesInserted}  (3-unit: т+м+шт per product)`);
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

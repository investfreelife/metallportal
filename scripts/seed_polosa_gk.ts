/**
 * Seed для категорий полосы г/к (W2-14).
 *
 * Один источник (раздел "Полоса г/к" прайса) разносит 85 SKU по 2 L3:
 *   category=="ocink"   → polosa-g-k-otsinkovannaya  (id e92f0baa-...)
 *   category=="regular" → polosa-g-k                 (id 54d6b78e-...)
 *
 * Источник: scripts/data/polosa_gk_skus.json (генерится из
 * scripts/data/polosa_gk_raw.txt через scripts/parse_polosa_gk.py).
 * 88 raw rows → 85 unique SKU (3 dedup-events).
 *
 * Multi-unit pricing (ADR-0013): 2 price_items per product
 * (unit="м" + unit="т"). 85 products + 170 price_items.
 *
 * Special features:
 * - Дробные цены/м (57.32) сохраняются как float в base_price (numeric).
 * - 1 SKU с length=NULL (polosa-120x6-rez-st3-nd, source — пустая длина).
 * - 1 SKU с steel_grade=NULL (polosa-50x5-ocink-6000, source — пустая марка).
 *
 * Slug fixed token order: rez → ocink → k → grade → length
 * (KB pattern, расширено в W2-14).
 *
 * Idempotency key: (product_id, supplier_id, unit) — multi-unit-aware.
 *
 * Usage:
 *   npx tsx scripts/seed_polosa_gk.ts             # dry-run
 *   npx tsx scripts/seed_polosa_gk.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_REGULAR = "54d6b78e-c203-4200-a2e8-d15f377f498b"; // polosa-g-k
const CATEGORY_OCINK = "e92f0baa-3f69-460d-8f3b-a74ecd2878f8"; // polosa-g-k-otsinkovannaya
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT_METER = "м";
const UNIT_TON = "т";

type ParsedSku = {
  name: string;
  slug: string;
  category: "regular" | "ocink";
  size: number;
  thickness: number;
  is_rez: boolean;
  is_ocink: boolean;
  is_k: boolean;
  steel_grade: string | null;
  coating: string | null;
  length: number | null;
  length_options: string[];
  price_per_meter: number;
  price_per_ton: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "polosa_gk_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null;
  thickness: number | null;
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
  const category_id = sku.category === "ocink" ? CATEGORY_OCINK : CATEGORY_REGULAR;
  return {
    name: sku.name,
    slug: sku.slug,
    category_id,
    diameter: sku.size, // products.diameter используется как S (ширина полосы)
    thickness: sku.thickness,
    steel_grade: sku.steel_grade,
    coating: sku.coating,
    length: sku.length,
    length_options: sku.length_options,
    unit: UNIT_TON, // primary unit для cart
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_polosa_gk.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);
  console.log(
    `${products.length} SKU loaded; expecting ${products.length * 2} price_items (multi-unit ADR-0013)`,
  );

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  const splitCount = { regular: 0, ocink: 0 };
  for (const s of skus) splitCount[s.category]++;
  console.log(`  regular → ${splitCount.regular} SKU → ${CATEGORY_REGULAR}`);
  console.log(`  ocink   → ${splitCount.ocink} SKU → ${CATEGORY_OCINK}\n`);

  console.log("First 5 SKUs:");
  for (let i = 0; i < Math.min(5, products.length); i++) {
    const p = products[i];
    const sku = skus[i];
    console.log(
      `  ${String(i + 1).padStart(3)} | ${sku.category.padEnd(8)} | ${p.name.padEnd(50)} | ` +
        `${(p.steel_grade ?? "—").padEnd(12)} | ` +
        `${sku.price_per_meter.toFixed(2).padStart(8)} ₽/м + ` +
        `${sku.price_per_ton.toLocaleString("ru-RU").padStart(8)} ₽/т | ${p.slug}`,
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

    // 2 price_items: т + м.
    for (const [unit, base_price] of [
      [UNIT_TON, sku.price_per_ton],
      [UNIT_METER, sku.price_per_meter],
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

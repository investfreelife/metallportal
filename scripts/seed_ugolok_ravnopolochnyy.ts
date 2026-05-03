/**
 * Seed для категорий равнополочного уголка (W2-12).
 *
 * Один источник (раздел 2 прайса) разносит SKU по ДВУМ L3 категориям:
 *   category=="nl"      → ugolok-ravnopolochnyy-nizkolegirovannyy
 *   category=="regular" → ugolok-ravnopolochnyy
 *
 * Источник: scripts/data/ugolok_ravnopolochnyy_skus.json
 * (генерится из ugolok_ravnopolochnyy_raw.txt через parse_ugolok_ravnopolochnyy.py).
 * 190 raw rows → 179 unique SKU после dedup + grade normalization.
 *
 * Особенности:
 * - 121 regular + 58 NL SKU
 * - 10 К-серия (special "k", специальные длины 2000-5500)
 * - 2 оцинкованных (steel_grade=NULL, coating="оцинкованный", slug-token "ocink")
 * - 2 SKU с length=NULL (source: "н/д")
 * - GRADE_NORMALIZATIONS: Ст255 → С255 (4 SKU, 0% total diff)
 *
 * ADR-0013 НЕ применяется (single-unit, обе ценовые колонки за тонну).
 *
 * Идемпотентность: SELECT slug → INSERT only if missing.
 *
 * Usage:
 *   npx tsx scripts/seed_ugolok_ravnopolochnyy.ts             # dry-run
 *   npx tsx scripts/seed_ugolok_ravnopolochnyy.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_REGULAR = "7cfe071e-9236-4354-8f51-a0c0584aaced"; // ugolok-ravnopolochnyy
const CATEGORY_NL = "6dce5436-3b0f-47c7-9378-92d7fbae0fed"; // ugolok-ravnopolochnyy-nizkolegirovannyy
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т";

type ParsedSku = {
  name: string;
  slug: string;
  category: "regular" | "nl";
  size: number;
  thickness: number;
  is_nl: boolean;
  is_special_k: boolean;
  is_ocink: boolean;
  steel_grade: string | null;
  coating: string | null;
  length: number | null;
  length_options: string[];
  base_price: number;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "ugolok_ravnopolochnyy_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null; // используем как S (главный размер)
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
  const category_id = sku.category === "nl" ? CATEGORY_NL : CATEGORY_REGULAR;
  return {
    name: sku.name,
    slug: sku.slug,
    category_id,
    diameter: sku.size,
    thickness: sku.thickness,
    steel_grade: sku.steel_grade,
    coating: sku.coating,
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
  console.log(`\n=== seed_ugolok_ravnopolochnyy.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);
  console.log(`${products.length} SKU loaded`);

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique\n`);

  const splitCount = { regular: 0, nl: 0 };
  for (const s of skus) splitCount[s.category]++;
  console.log(`  regular → ${splitCount.regular} SKU → ${CATEGORY_REGULAR}`);
  console.log(`  nl      → ${splitCount.nl} SKU → ${CATEGORY_NL}\n`);

  console.log("First 5 SKUs (mix categories):");
  for (let i = 0; i < Math.min(5, products.length); i++) {
    const p = products[i];
    const sku = skus[i];
    console.log(
      `  ${String(i + 1).padStart(3)} | ${sku.category.padEnd(8)} | ${p.name.padEnd(40)} | ` +
        `${(p.steel_grade ?? "—").padEnd(12)} | ${sku.base_price.toLocaleString("ru-RU").padStart(10)} ₽/т | ${p.slug}`,
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

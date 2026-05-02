/**
 * Seed для категории `armatura-a800` (W2-4).
 *
 * Категория уже существует в БД (id ac1af4fe-..., child of armatura-katanka,
 * sort_order=4). Этот скрипт заливает 6 SKU из ручного прайса (7 строк после
 * dedup row 2≡3: 12 А800 6700 за 54490).
 *
 * Особенность А800 vs W2-2 (А1/А240): в данных Сергея марка стали НЕ указана.
 * Решение — `steel_grade: null`. Slug без grade: `armatura-{D}-a800-{length}`.
 * UI ProductTable уже умеет рендерить null grade как "—" (line 143).
 *
 * Идемпотентность:
 *   - products: SELECT slug → INSERT only if missing.
 *   - price_items: SELECT (product_id, supplier_id) → INSERT only if missing.
 *
 * Usage:
 *   npx tsx scripts/seed_armatura_a800.ts             # dry-run (default)
 *   npx tsx scripts/seed_armatura_a800.ts --commit    # реальная запись
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "ac1af4fe-3c2b-4680-b0e9-44ff31b0ca89"; // armatura-a800
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001"; // default Москва-supplier
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т";

type SkuInput = {
  diameter: number;
  length: 6700 | 7600 | 11700;
  base_price: number;
};

// 6 уникальных SKU (после dedup row 2 ≡ row 3 в исходном прайсе:
// "12 А800 6700 54490" встречалось дважды).
const SKUS: SkuInput[] = [
  { diameter: 12, length: 11700, base_price: 54490 },
  { diameter: 12, length: 6700,  base_price: 54490 },
  { diameter: 12, length: 7600,  base_price: 53490 },
  { diameter: 14, length: 7600,  base_price: 54490 },
  { diameter: 14, length: 6700,  base_price: 54490 },
  { diameter: 14, length: 11700, base_price: 54490 },
];

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number;
  steel_grade: string | null;
  length: number;
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
};

function buildProduct(sku: SkuInput): ProductRow {
  return {
    name: `Арматура ${sku.diameter} кл А800`,
    // Без grade в slug (steel_grade NULL — поставщик марку не уточнил).
    slug: `armatura-${sku.diameter}-a800-${sku.length}`,
    category_id: CATEGORY_ID,
    diameter: sku.diameter,
    steel_grade: null,
    length: sku.length,
    length_options: [String(sku.length)],
    unit: UNIT,
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT (will write to DB)" : "DRY-RUN (no writes)";

  console.log(`\n=== seed_armatura_a800.ts — ${mode} ===\n`);

  const products = SKUS.map(buildProduct);

  console.log("6 SKU prepared:\n");
  console.log(
    "  # | name                       | diameter | grade | length | base_price | slug",
  );
  console.log(
    "  --|----------------------------|----------|-------|--------|------------|" +
      "-".repeat(40),
  );
  products.forEach((p, i) => {
    const sku = SKUS[i];
    const grade = (p.steel_grade ?? "—").padEnd(5);
    console.log(
      `  ${String(i + 1).padStart(2)} | ${p.name.padEnd(26)} | ` +
        `${String(p.diameter).padStart(8)} | ${grade} | ` +
        `${String(p.length).padStart(6)} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} | ${p.slug}`,
    );
  });

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(
      `\n❌ Slug collision: ${products.length} SKUs but only ${slugSet.size} unique`,
    );
    process.exit(1);
  }
  console.log(`\n✅ All ${products.length} slugs unique\n`);

  if (!isCommit) {
    console.log("Dry-run complete. Re-run with --commit to insert into database.\n");
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
    const sku = SKUS[i];

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

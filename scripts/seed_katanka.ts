/**
 * Seed для категории `katanka` (W2-5).
 *
 * Категория уже существует в БД (id 875ea766-..., child of armatura-katanka,
 * sort_order=5, is_active=true). Этот скрипт заливает 9 SKU из ручного
 * прайса МеталлСтрой. Все 9 уникальны по (diameter, length) — dedup'ить
 * нечего.
 *
 * Конвенция name для мотков (вариант B, согласовано в чате):
 *   - штатные длины:  "Катанка {D}"          (например "Катанка 5.5")
 *   - мотки:           "Катанка {D} мотки"   (например "Катанка 5.5 мотки")
 *
 * Конвенция slug:
 *   - штатные:  katanka-{D-with-dash-for-fraction}-{grade}-{length}
 *   - мотки:    katanka-{D}-motki-{grade}-motki  (как в риф-арматуре W1)
 *
 * Идемпотентность: ON CONFLICT (slug) DO NOTHING semantics через
 * SELECT-INSERT pattern (как в seed_armatura_a800.ts).
 *
 * Usage:
 *   npx tsx scripts/seed_katanka.ts             # dry-run (default)
 *   npx tsx scripts/seed_katanka.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "875ea766-f2a1-41f7-96ed-1dffc4289b5c"; // katanka
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001"; // default Москва-supplier
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т";

type SkuInput = {
  diameter: number;
  // строковая исходная длина из прайса; numeric или "мотки"
  length_raw: "6000" | "11700" | "мотки";
  base_price: number;
};

// 9 уникальных SKU (исходные 9 строк прайса, дублей нет).
const SKUS: SkuInput[] = [
  { diameter: 5.5, length_raw: "6000",  base_price: 54490 },
  { diameter: 5.5, length_raw: "мотки", base_price: 53490 },
  { diameter: 6,   length_raw: "мотки", base_price: 53490 },
  { diameter: 6.5, length_raw: "6000",  base_price: 55490 },
  { diameter: 6.5, length_raw: "мотки", base_price: 54990 },
  { diameter: 8,   length_raw: "мотки", base_price: 53490 },
  { diameter: 10,  length_raw: "11700", base_price: 54990 },
  { diameter: 10,  length_raw: "мотки", base_price: 54490 },
  { diameter: 12,  length_raw: "мотки", base_price: 53990 },
];

const STEEL_GRADE = "Ст3"; // все 9 SKU
const STEEL_GRADE_SLUG = "st3";

/** "5.5" → "5-5" для slug. Целочисленные диаметры остаются как "10". */
function diameterToSlug(d: number): string {
  return String(d).replace(/\./g, "-");
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number;
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
};

function buildProduct(sku: SkuInput): ProductRow {
  const isMotki = sku.length_raw === "мотки";
  const dSlug = diameterToSlug(sku.diameter);
  const baseName = `Катанка ${sku.diameter}`;

  return {
    // B-конвенция: name = "Катанка 5.5" / "Катанка 5.5 мотки".
    name: isMotki ? `${baseName} мотки` : baseName,
    slug: isMotki
      ? `katanka-${dSlug}-motki-${STEEL_GRADE_SLUG}-motki`
      : `katanka-${dSlug}-${STEEL_GRADE_SLUG}-${sku.length_raw}`,
    category_id: CATEGORY_ID,
    diameter: sku.diameter,
    steel_grade: STEEL_GRADE,
    length: isMotki ? null : Number(sku.length_raw),
    length_options: [isMotki ? "мотки" : sku.length_raw],
    unit: UNIT,
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT (will write to DB)" : "DRY-RUN (no writes)";

  console.log(`\n=== seed_katanka.ts — ${mode} ===\n`);

  const products = SKUS.map(buildProduct);

  console.log("9 SKU prepared:\n");
  console.log(
    "  # | name                 | diameter | grade | length | base_price | slug",
  );
  console.log(
    "  --|----------------------|----------|-------|--------|------------|" +
      "-".repeat(40),
  );
  products.forEach((p, i) => {
    const sku = SKUS[i];
    const lenStr = (p.length ?? "мотки").toString().padStart(6);
    const grade = p.steel_grade.padEnd(5);
    console.log(
      `  ${String(i + 1).padStart(2)} | ${p.name.padEnd(20)} | ` +
        `${String(p.diameter).padStart(8)} | ${grade} | ${lenStr} | ` +
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

/**
 * Seed-скрипт для категории `armatura-gladkaya-a240-a1` (W2-2).
 *
 * Закрывает: первая загрузка прайса в категорию "Арматура гладкая А240 А1"
 * (под parent `armatura-katanka` → root `sortovoy-prokat`).
 *
 * Источник данных: ручной прайс от Сергея (28 строк, после dedup'а — 27 SKU).
 * 9 решений согласовано в чате (см. REPORT_v2_catalog_armatura_a240.md).
 *
 * Идемпотентность:
 *   - products: ON CONFLICT (slug) DO NOTHING — повторный run не дублирует.
 *   - price_items: SELECT (product_id, supplier_id) → INSERT only if missing.
 *
 * Usage:
 *   npx tsx scripts/seed_armatura_gladkaya_a240.ts             # dry-run (default, безопасно)
 *   npx tsx scripts/seed_armatura_gladkaya_a240.ts --commit    # реальная запись в БД
 *
 * Переменные окружения (из .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

// Подгружаем .env.local так же как Next.js на dev/build — скрипт работает
// при прямом запуске через tsx (без Next runtime).
loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "d31d9d81-7eac-41d2-a9af-9108fc00238a"; // armatura-gladkaya-a240-a1
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001"; // default Москва-supplier
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT = "т"; // base_price указана за тонну

type SkuInput = {
  diameter: number;
  steel_grade: "Ст3" | "А240" | "А240С";
  length_raw: "6000" | "11700" | "мотки";
  base_price: number;
};

// 27 уникальных SKU (после dedup'а row 13 ≡ row 15 в исходном прайсе:
// "12 Ст3 11700 51490" встречалось дважды).
const SKUS: SkuInput[] = [
  { diameter: 6, steel_grade: "Ст3", length_raw: "6000", base_price: 54490 },
  { diameter: 6, steel_grade: "А240", length_raw: "6000", base_price: 54490 },
  { diameter: 6, steel_grade: "А240", length_raw: "мотки", base_price: 53490 },
  { diameter: 8, steel_grade: "Ст3", length_raw: "6000", base_price: 54990 },
  { diameter: 8, steel_grade: "А240", length_raw: "11700", base_price: 55490 },
  { diameter: 8, steel_grade: "А240", length_raw: "6000", base_price: 54990 },
  { diameter: 8, steel_grade: "А240", length_raw: "мотки", base_price: 53990 },
  { diameter: 10, steel_grade: "А240С", length_raw: "11700", base_price: 54990 },
  { diameter: 10, steel_grade: "А240С", length_raw: "6000", base_price: 54990 },
  { diameter: 10, steel_grade: "Ст3", length_raw: "6000", base_price: 54990 },
  { diameter: 10, steel_grade: "А240С", length_raw: "мотки", base_price: 53990 },
  { diameter: 12, steel_grade: "Ст3", length_raw: "6000", base_price: 50990 },
  { diameter: 12, steel_grade: "Ст3", length_raw: "11700", base_price: 51490 },
  { diameter: 12, steel_grade: "А240", length_raw: "11700", base_price: 51490 },
  // row 15 в исходных данных — дубликат row 13, исключён.
  { diameter: 12, steel_grade: "Ст3", length_raw: "мотки", base_price: 54490 },
  { diameter: 14, steel_grade: "А240", length_raw: "11700", base_price: 49990 },
  { diameter: 14, steel_grade: "Ст3", length_raw: "6000", base_price: 49490 },
  { diameter: 14, steel_grade: "Ст3", length_raw: "11700", base_price: 49990 },
  { diameter: 16, steel_grade: "А240С", length_raw: "11700", base_price: 49990 },
  { diameter: 18, steel_grade: "А240", length_raw: "11700", base_price: 49990 },
  { diameter: 20, steel_grade: "А240", length_raw: "11700", base_price: 49990 },
  { diameter: 22, steel_grade: "А240", length_raw: "11700", base_price: 49490 },
  { diameter: 25, steel_grade: "А240", length_raw: "11700", base_price: 49990 },
  { diameter: 28, steel_grade: "Ст3", length_raw: "11700", base_price: 54490 },
  { diameter: 32, steel_grade: "Ст3", length_raw: "11700", base_price: 54490 },
  { diameter: 36, steel_grade: "Ст3", length_raw: "11700", base_price: 55490 },
  { diameter: 40, steel_grade: "Ст3", length_raw: "11700", base_price: 55490 },
];

// Кириллица → латиница для slug. Ограничено марками которые мы используем.
const STEEL_GRADE_SLUG: Record<SkuInput["steel_grade"], string> = {
  Ст3: "st3",
  А240: "a240",
  А240С: "a240s",
};

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
  const namePrefix = `Арматура ${sku.diameter} А1`;
  const name = isMotki ? `${namePrefix} мотки` : namePrefix;

  const gradeSlug = STEEL_GRADE_SLUG[sku.steel_grade];
  const lengthSlug = isMotki ? "motki" : sku.length_raw;
  // motki-товары получают `motki` в slug дважды (как у sibling-конвенции
  // в риф-арматуре: armatura-10-a3-motki-v500s-motki). Это явный визуальный
  // маркер мотков в URL без потери уникальности.
  const slug = isMotki
    ? `armatura-${sku.diameter}-a1-motki-${gradeSlug}-motki`
    : `armatura-${sku.diameter}-a1-${gradeSlug}-${lengthSlug}`;

  return {
    name,
    slug,
    category_id: CATEGORY_ID,
    diameter: sku.diameter,
    steel_grade: sku.steel_grade,
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

  console.log(`\n=== seed_armatura_gladkaya_a240.ts — ${mode} ===\n`);

  const products = SKUS.map(buildProduct);

  // Pretty-print таблица для review.
  console.log("27 SKU prepared:\n");
  console.log(
    "  # | name                       | diameter | steel | length | base_price | slug",
  );
  console.log(
    "  --|----------------------------|----------|-------|--------|------------|" +
      "-".repeat(50),
  );
  products.forEach((p, i) => {
    const sku = SKUS[i];
    const lenStr = (p.length ?? "мотки").toString().padStart(6);
    const grade = (sku.steel_grade as string).padEnd(5);
    console.log(
      `  ${String(i + 1).padStart(2)} | ${p.name.padEnd(26)} | ` +
        `${String(p.diameter).padStart(8)} | ${grade} | ${lenStr} | ` +
        `${sku.base_price.toLocaleString("ru-RU").padStart(10)} | ${p.slug}`,
    );
  });

  // Slug duplicate sanity-check (defence в depth — 27 SKU должны быть unique).
  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(
      `\n❌ Slug collision: ${products.length} SKUs but only ${slugSet.size} unique slugs`,
    );
    process.exit(1);
  }
  console.log(`\n✅ All ${products.length} slugs unique\n`);

  if (!isCommit) {
    console.log(
      "Dry-run complete. Re-run with --commit to insert into database.\n",
    );
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

    // 1. SELECT product by slug (idempotency check).
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

    // 2. Idempotency на price_items: уникальность по (product_id, supplier_id).
    //    В schema нет UNIQUE constraint, проверяем вручную.
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

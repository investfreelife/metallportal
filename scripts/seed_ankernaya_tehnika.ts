/**
 * Seed для Анкерной техники (wave anchors).
 *
 * Source: scripts/data/ankernaya_tehnika_skus.json (генерится из
 * scripts/data/ankernaya_tehnika_raw.txt через
 * scripts/parse_ankernaya_tehnika.py).
 * 488 raw rows → 226 unique SKUs (pack-variants aggregation).
 *
 * 12 anchor types в один L3 ankernaya-tehnika через slug-prefix
 * (mixed-category-with-type-prefix pattern, lesson 047 + W2-12 + W2-16):
 *
 *   anker-ab-       Анкерный болт (АБ)
 *   anker-ag-       Анкерный болт с гайкой (АГ)
 *   anker-vsr-      Анкер с ВСР (3-size с inst_D)
 *   anker-klin-     Анкер-клин
 *   anker-g-        Анкерный болт с Г-образным крюком
 *   anker-kolts-    Анкерный болт с кольцом
 *   anker-polkolts- Анкерный болт с полукольцом
 *   anker-zab-      Анкер забивной (3-size)
 *   anker-klinov-   Анкер клиновой
 *   anker-lat-      Анкер латунный (цанга, 3-size)
 *   anker-dgm-      Металлический дюбель-гвоздь (3-size)
 *   anker-ram-      Анкер рамный
 *
 * Single-unit pricing (шт only, ratio=1000 = arithmetic identity).
 * 226 products + 226 price_items.
 *
 * Sergey's Q2-Q5 уточнения:
 *   Q2: pack_options[] в dimensions JSONB с price_per_piece_rub per pack-qty
 *   Q3: unit='шт', base_price = MIN(pack_options[].price_per_piece_rub)
 *   Q4: dimensions.installation_diameter (без миграции; 11 SKU из 226)
 *   Q5: products.article = primary (smallest qty pack); все articles в pack_options
 *
 * Idempotency key: slug (1 product per (anchor_type, D, L, [inst_D]))
 *  + (product_id, supplier_id, unit) для price_items.
 *
 * Usage:
 *   npx tsx scripts/seed_ankernaya_tehnika.ts             # dry-run
 *   npx tsx scripts/seed_ankernaya_tehnika.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ANKERNAYA = "8c15bfa8-818a-4674-81d9-6a026bd36ca5"; // ankernaya-tehnika
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const UNIT_PIECE = "шт";

type PackOption = {
  qty: number;
  article: string;
  price_per_piece_rub: number;
};

type ParsedSku = {
  name: string;
  slug: string;
  anchor_type: string;
  display_type: string;
  diameter: number;
  length: number;
  installation_diameter: number | null;
  primary_article: string;
  pack_options: PackOption[];
  min_price_per_piece: number;
  dimensions: Record<string, unknown>;
};

function loadSkus(): ParsedSku[] {
  const path = resolve(__dirname, "data", "ankernaya_tehnika_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedSku[];
}

type ProductRow = {
  name: string;
  slug: string;
  category_id: string;
  diameter: number | null;
  length: number | null;
  unit: string;
  article: string;
  dimensions: Record<string, unknown>;
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
    category_id: CATEGORY_ANKERNAYA,
    diameter: sku.diameter,
    length: sku.length,
    unit: UNIT_PIECE,
    article: sku.primary_article,
    dimensions: sku.dimensions,
    is_active: true,
    min_order: 1.0,
  };
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_ankernaya_tehnika.ts — ${mode} ===\n`);

  const skus = loadSkus();
  const products = skus.map(buildProduct);

  const slugSet = new Set(products.map((p) => p.slug));
  if (slugSet.size !== products.length) {
    console.error(`❌ Slug collision`);
    process.exit(1);
  }
  console.log(`✅ All ${products.length} slugs unique`);

  // Distribution by anchor_type.
  const byType: Record<string, number> = {};
  for (const s of skus) byType[s.anchor_type] = (byType[s.anchor_type] || 0) + 1;
  console.log(`\nDistribution:`);
  for (const [at, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${at.padEnd(32)} → ${String(n).padStart(4)} SKU`);
  }

  // Pack-variant stats.
  const totalPacks = skus.reduce((acc, s) => acc + s.pack_options.length, 0);
  const inst3size = skus.filter((s) => s.installation_diameter !== null).length;
  console.log(`\nPack-variants stored: ${totalPacks} across ${skus.length} SKUs (avg ${(totalPacks / skus.length).toFixed(2)})`);
  console.log(`SKUs с installation_diameter: ${inst3size}`);

  console.log("\nFirst 3 SKUs из каждого type (sample):");
  const seen = new Set<string>();
  for (const sku of skus) {
    if (seen.size >= 12) break;
    if (seen.has(sku.anchor_type)) continue;
    seen.add(sku.anchor_type);
    const packsStr = sku.pack_options
      .map((po) => `${po.qty}шт@${po.price_per_piece_rub}`)
      .slice(0, 4)
      .join(" / ") + (sku.pack_options.length > 4 ? ` … (+${sku.pack_options.length - 4})` : "");
    console.log(
      `  ${sku.slug.padEnd(38)} | ${sku.name.padEnd(40).slice(0, 40)} | art=${sku.primary_article} | от ${sku.min_price_per_piece}₽/шт`,
    );
    console.log(`    packs: ${packsStr}`);
  }

  if (!isCommit) {
    console.log(`\nDry-run complete.\n`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
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

    // 1 price_item per product (unit="шт", base_price = MIN price_per_piece).
    const { data: existingPrice, error: pSelErr } = await supabase
      .from("price_items")
      .select("id")
      .eq("product_id", productId)
      .eq("supplier_id", SUPPLIER_ID)
      .eq("unit", UNIT_PIECE)
      .maybeSingle();
    if (pSelErr) {
      errors.push(`[${p.slug}/шт] price select: ${pSelErr.message}`);
      continue;
    }

    if (existingPrice) {
      pricesSkipped++;
      continue;
    }

    const priceRow: PriceRow = {
      product_id: productId,
      supplier_id: SUPPLIER_ID,
      base_price: sku.min_price_per_piece,
      markup_pct: MARKUP_PCT,
      currency: CURRENCY,
      min_quantity: 1.0,
      in_stock: true,
      unit: UNIT_PIECE,
    };
    const { error: pInsErr } = await supabase.from("price_items").insert(priceRow);
    if (pInsErr) {
      errors.push(`[${p.slug}/шт] insert price: ${pInsErr.message}`);
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

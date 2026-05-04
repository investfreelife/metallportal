/**
 * Seed для Лист оцинкованный (W2-17).
 *
 * Source: scripts/data/list_otsinkovannyy_skus.json (генерится из
 * scripts/data/list_otsinkovannyy_raw.md через parse_list_otsinkovannyy.py).
 * 82 raw rows → 62 unique SKUs (18 dedup events).
 *
 * Pipeline (per ТЗ #005, POLICY_raw-imports compliance):
 *   1. Load parsed SKUs
 *   2. reconcile() → bucket sort (new / identicalDupes / priceChanges / metadataConflicts)
 *   3. STOP при metadataConflicts (escalate в REPORT)
 *   4. STOP при priceChanges (REPORT, NO update)
 *   5. Seed только `new` bucket
 *
 * Multi-unit pricing (ADR-0013):
 *   - Если ₽/шт в источнике → 2 price_items (unit="шт" + unit="т")
 *   - Только ₽/т (для "длина под заказ" SKU) → 1 price_item
 *
 * Schema: используем существующую `dimensions` JSONB колонку (без миграций).
 *
 * Usage:
 *   npx tsx scripts/seed_list_otsinkovannyy.ts             # dry-run
 *   npx tsx scripts/seed_list_otsinkovannyy.ts --commit    # запись в БД
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";

import {
  reconcile,
  formatReconcileMarkdown,
  type ParsedSku,
  type ReconcileResult,
} from "../lib/raw-import-reconcile";

loadEnvConfig(resolve(__dirname, ".."));

const CATEGORY_ID = "fc886e63-fc86-4cbf-acb5-83a61dba91bb"; // list-otsinkovannyy
const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";

type ParsedListOtsink = ParsedSku & {
  category_slug: string;
  category_id: string;
  thickness: number;
  primary_unit: string;
};

function loadSkus(): ParsedListOtsink[] {
  const path = resolve(__dirname, "data", "list_otsinkovannyy_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedListOtsink[];
}

/**
 * Per-category nameNormalize: для лист оцинкованный — strip whitespace,
 * нормализовать decimal separator (запятая → точка), strip "длина под заказ"
 * как noisy suffix (variant marker, не identity).
 */
function listOcinkNormalize(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/,(?=\d)/g, ".")  // 0,35 → 0.35
    .toLowerCase();
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_list_otsinkovannyy.ts — ${mode} ===\n`);

  const skus = loadSkus();
  console.log(`Loaded ${skus.length} parsed SKUs`);

  const slugSet = new Set(skus.map((s) => s.slug));
  if (slugSet.size !== skus.length) {
    console.error(`❌ Slug collision in parsed`);
    process.exit(1);
  }

  // Reconcile.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  console.log("\nRunning reconcile (bulk SELECT existing products + price_items)...");
  const result: ReconcileResult = await reconcile(skus, supabase, {
    supplierId: SUPPLIER_ID,
    nameNormalize: listOcinkNormalize,
    priceEpsilonRub: 0.01,
  });

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new (готовы к seed):       ${result.new.length}`);
  console.log(`  identicalDupes (no-op):    ${result.identicalDupes.length}`);
  console.log(`  priceChanges (REPORT only): ${result.priceChanges.length}`);
  console.log(`  metadataConflicts:         ${result.metadataConflicts.length}`);

  // Persist reconcile result для embed в REPORT файл.
  const reportPath = resolve(__dirname, "data", "list_otsinkovannyy_reconcile.md");
  writeFileSync(reportPath, formatReconcileMarkdown(result), "utf-8");
  console.log(`\n  reconcile markdown → ${reportPath}`);

  // POLICY: STOP if any metadataConflicts or priceChanges (escalation needed).
  if (result.metadataConflicts.length > 0) {
    console.error(`\n❌ ${result.metadataConflicts.length} metadata conflicts — STOP, escalate via REPORT`);
    process.exit(1);
  }
  if (result.priceChanges.length > 0) {
    console.error(
      `\n⚠ ${result.priceChanges.length} price changes detected — STOP, REPORT only (NO update per POLICY)`,
    );
    process.exit(1);
  }

  console.log(`\nNo conflicts, no price changes. Proceeding to seed only \`new\` bucket (${result.new.length} SKUs).`);

  if (!isCommit) {
    console.log("\nDry-run complete. First 5 new SKUs:");
    for (const s of result.new.slice(0, 5) as ParsedListOtsink[]) {
      const pricesStr = s.prices.map((p) => `${p.base_price} ₽/${p.unit}`).join(" + ");
      console.log(`  ${s.slug.padEnd(50)} | ${s.name.slice(0, 40).padEnd(40)} | ${pricesStr}`);
    }
    return;
  }

  // Seed `new` bucket.
  let productsInserted = 0;
  let pricesInserted = 0;
  const errors: string[] = [];

  for (const sku of result.new as ParsedListOtsink[]) {
    const productRow = {
      name: sku.name,
      slug: sku.slug,
      category_id: CATEGORY_ID,
      thickness: sku.thickness,
      length: null,
      steel_grade: sku.steel_grade,
      dimensions: sku.dimensions,
      unit: sku.primary_unit,
      is_active: true,
      min_order: 1.0,
    };

    const { data: ins, error: insErr } = await supabase
      .from("products")
      .insert(productRow)
      .select("id")
      .single();
    if (insErr || !ins) {
      errors.push(`[${sku.slug}] insert product: ${insErr?.message ?? "no row"}`);
      continue;
    }
    productsInserted++;
    const productId = ins.id;

    for (const p of sku.prices) {
      const priceRow = {
        product_id: productId,
        supplier_id: SUPPLIER_ID,
        base_price: p.base_price,
        markup_pct: MARKUP_PCT,
        currency: CURRENCY,
        min_quantity: 1.0,
        in_stock: true,
        unit: p.unit,
      };
      const { error: pInsErr } = await supabase.from("price_items").insert(priceRow);
      if (pInsErr) {
        errors.push(`[${sku.slug}/${p.unit}] insert price: ${pInsErr.message}`);
        continue;
      }
      pricesInserted++;
    }
  }

  console.log(`\n=== Commit summary ===`);
  console.log(`  products inserted: ${productsInserted}`);
  console.log(`  price_items inserted: ${pricesInserted}`);
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

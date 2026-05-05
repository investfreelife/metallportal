/**
 * Seed для Круг никелевый — wave W2-26 #i010 (catalog-images).
 *
 * Source: scripts/data/krug_nikelevyy_skus.json (70 SKUs).
 *
 * Reconcile expectation:
 *   - 63 existing slugs (40ХН/12ХН3А/40ХН2МА/12Х2Н4А) → identicalDupes ИЛИ
 *     metadataConflicts (existing dimensions=null, mine=JSONB enrichment)
 *   - 7 NEW (40ХН2МА-Ш ЭШП обточенный) → exclusive identity → seed
 *   - 0 priceChanges expected (existing prices = MIN of source 2-tier, lesson 083 verified)
 *
 * Usage:
 *   npx tsx scripts/seed_krug_nikelevyy.ts             # dry-run
 *   npx tsx scripts/seed_krug_nikelevyy.ts --commit
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

const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";

type ParsedKrug = ParsedSku & {
  category_slug: string;
  category_id: string;
  primary_unit: string;
};

function loadSkus(): ParsedKrug[] {
  const path = resolve(__dirname, "data", "krug_nikelevyy_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedKrug[];
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_krug_nikelevyy.ts — ${mode} ===\n`);

  const skus = loadSkus();
  console.log(`Loaded ${skus.length} parsed SKU(s)`);

  if (new Set(skus.map((s) => s.slug)).size !== skus.length) {
    console.error(`❌ Slug collision in parsed`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  console.log("\nRunning reconcile...");
  const result: ReconcileResult = await reconcile(skus, supabase, {
    supplierId: SUPPLIER_ID,
    priceEpsilonRub: 0.01,
  });

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new:                ${result.new.length}`);
  console.log(`  identicalDupes:     ${result.identicalDupes.length}`);
  console.log(`  priceChanges:       ${result.priceChanges.length}`);
  console.log(`  metadataConflicts:  ${result.metadataConflicts.length}`);

  const reportPath = resolve(__dirname, "data", "krug_nikelevyy_reconcile.md");
  writeFileSync(reportPath, formatReconcileMarkdown(result), "utf-8");

  // Per ТЗ #i010: metadataConflicts soft-skip + escalate (existing dimensions=null per pre-flight Q1)
  if (result.metadataConflicts.length > 0) {
    console.warn(
      `\n⚠ ${result.metadataConflicts.length} metadata conflicts — existing dimensions=null, escalating in reconcile.md, ` +
      `proceeding с ${result.new.length} new SKUs only.`,
    );
  }
  if (result.priceChanges.length > 0) {
    console.error(`\n⚠ price changes detected — STOP per POLICY`);
    process.exit(1);
  }

  console.log(`\nProceeding with ${result.new.length} new SKU(s).`);

  if (!isCommit) {
    for (const s of (result.new as ParsedKrug[]).slice(0, 8)) {
      const priceStr = s.prices.length
        ? `${s.prices[0].base_price} ₽/${s.prices[0].unit}`
        : "(под заказ)";
      console.log(`  ${s.slug.padEnd(60)} | ${priceStr}`);
    }
    console.log("\nDry-run complete.");
    return;
  }

  let productsInserted = 0;
  let pricesInserted = 0;
  const errors: string[] = [];

  const newSkus = result.new as ParsedKrug[];
  if (newSkus.length === 0) {
    console.log("\nNo new SKUs to seed.");
    return;
  }

  const productRows = newSkus.map((sku) => ({
    name: sku.name,
    slug: sku.slug,
    category_id: sku.category_id,
    diameter: sku.diameter ?? null,
    thickness: sku.thickness ?? null,
    length: sku.length ?? null,
    steel_grade: sku.steel_grade ?? null,
    dimensions: sku.dimensions,
    unit: sku.primary_unit,
    is_active: true,
    min_order: 1.0,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("products")
    .insert(productRows)
    .select("id, slug");
  if (insErr || !inserted) {
    console.error(`Insert products error: ${insErr?.message ?? "no rows"}`);
    process.exit(1);
  }
  productsInserted = inserted.length;

  const slugToId = new Map<string, string>(inserted.map((p) => [p.slug, p.id]));
  const priceRows: Array<Record<string, unknown>> = [];
  for (const sku of newSkus) {
    const pid = slugToId.get(sku.slug);
    if (!pid) {
      errors.push(`[${sku.slug}] no product_id after insert`);
      continue;
    }
    for (const p of sku.prices) {
      priceRows.push({
        product_id: pid,
        supplier_id: SUPPLIER_ID,
        base_price: p.base_price,
        markup_pct: MARKUP_PCT,
        currency: CURRENCY,
        min_quantity: 1.0,
        in_stock: true,
        unit: p.unit,
      });
    }
  }
  if (priceRows.length > 0) {
    const { error: pInsErr } = await supabase.from("price_items").insert(priceRows);
    if (pInsErr) {
      errors.push(`insert price_items: ${pInsErr.message}`);
    } else {
      pricesInserted = priceRows.length;
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
  console.log(`\n  ✅ all rows processed cleanly`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

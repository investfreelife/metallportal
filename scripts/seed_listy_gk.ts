/**
 * Seed для Листы стальные г/к (W2-24, multi-target).
 *
 * Source: scripts/data/listy_gk_skus.json (504 SKUs across 5 categories).
 *
 * Multi-target classifier (5 buckets):
 *   list-g-k:                          ~163 SKUs (Ст3/Ст20/Ст45/etc carbon)
 *   list-nerzhaveyuschiy:              ~195 SKUs (AISI / нержавеющие)
 *   list-iznosostoykiy:                ~45 SKUs (NM 500/450, Mn13)
 *   list-g-k-normalnoy-prochnosti:     ~86 SKUs (40Х/30ХГСА конструкционные)
 *   list-g-k-povyshennoy-prochnosti:   ~15 SKUs (HSLA Q690E/S420МС/С355)
 *
 * Mixed-source pricing (parser handle):
 *   - Multi-unit: ₽/кг + ₽/т (real ratios 928-999, lesson 066 band)
 *   - Single-unit: ₽/т only (для rows где source has only one tier OR volume-tier identical)
 *
 * Pipeline через lib/raw-import-reconcile.ts (POLICY compliance).
 *
 * Per ТЗ #016 — multi-target seed via category_id from JSON (parser already classified).
 *
 * Usage:
 *   npx tsx scripts/seed_listy_gk.ts             # dry-run
 *   npx tsx scripts/seed_listy_gk.ts --commit
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

type ParsedListyGk = ParsedSku & {
  category_slug: string;
  category_id: string;
  thickness: number;
  primary_unit: string;
};

function loadSkus(): ParsedListyGk[] {
  const path = resolve(__dirname, "data", "listy_gk_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedListyGk[];
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_listy_gk.ts — ${mode} ===\n`);

  const skus = loadSkus();
  console.log(`Loaded ${skus.length} parsed SKU(s) across categories:`);
  const byCategory: Record<string, number> = {};
  for (const s of skus) byCategory[s.category_slug] = (byCategory[s.category_slug] ?? 0) + 1;
  for (const [c, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(40)} → ${n}`);
  }

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

  console.log("\nRunning reconcile across all 504 SKUs...");
  const result: ReconcileResult = await reconcile(skus, supabase, {
    supplierId: SUPPLIER_ID,
    priceEpsilonRub: 0.01,
  });

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new:                ${result.new.length}`);
  console.log(`  identicalDupes:     ${result.identicalDupes.length}`);
  console.log(`  priceChanges:       ${result.priceChanges.length}`);
  console.log(`  metadataConflicts:  ${result.metadataConflicts.length}`);

  const reportPath = resolve(__dirname, "data", "listy_gk_reconcile.md");
  writeFileSync(reportPath, formatReconcileMarkdown(result), "utf-8");

  if (result.metadataConflicts.length > 0) {
    console.error(`\n❌ metadata conflicts — STOP, escalate`);
    process.exit(1);
  }
  if (result.priceChanges.length > 0) {
    console.error(`\n⚠ price changes detected — STOP per POLICY`);
    process.exit(1);
  }

  console.log(`\nNo conflicts. Proceeding with ${result.new.length} new SKU(s).`);

  if (!isCommit) {
    for (const s of (result.new as ParsedListyGk[]).slice(0, 5)) {
      const pricesStr = s.prices.map((p) => `${p.base_price}₽/${p.unit}`).join("+");
      console.log(`  ${s.slug.padEnd(50)} | ${s.category_slug.padEnd(35)} | ${pricesStr}`);
    }
    console.log("\nDry-run complete.");
    return;
  }

  let productsInserted = 0;
  let pricesInserted = 0;
  const errors: string[] = [];

  for (const sku of result.new as ParsedListyGk[]) {
    const productRow = {
      name: sku.name,
      slug: sku.slug,
      category_id: sku.category_id,
      thickness: sku.thickness,
      length: sku.length ?? null,
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

    for (const p of sku.prices) {
      const { error: pInsErr } = await supabase.from("price_items").insert({
        product_id: ins.id,
        supplier_id: SUPPLIER_ID,
        base_price: p.base_price,
        markup_pct: MARKUP_PCT,
        currency: CURRENCY,
        min_quantity: 1.0,
        in_stock: true,
        unit: p.unit,
      });
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
  console.log(`\n  ✅ all rows processed cleanly`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

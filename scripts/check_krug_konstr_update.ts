/**
 * UPDATE check для Круг г/к конструкционный (W2-23, ТЗ #014).
 *
 * **POLICY validation only — НЕ apply changes.**
 *
 * Pipeline:
 *   1. Load parsed SKUs from JSON (326 unique)
 *   2. Reconcile через `lib/raw-import-reconcile.ts`
 *   3. Bucket sort: new / identicalDupes / priceChanges / metadataConflicts
 *   4. Output stat
 *   5. STOP — REPORT generated, никаких INSERT / UPDATE / DELETE
 *
 * Per ТЗ #014 (lesson 075):
 *   - Если metadataConflicts → STOP, escalate
 *   - Если priceChanges → REPORT diff table, NOT apply
 *   - Если только new + identicalDupes → no PR action (read-only check)
 *
 * Usage:
 *   npx tsx scripts/check_krug_konstr_update.ts
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

type ParsedKrugKonstr = ParsedSku & {
  category_slug: string;
  category_id: string;
  diameter: number;
  primary_unit: string;
};

function loadSkus(): ParsedKrugKonstr[] {
  const path = resolve(__dirname, "data", "krug_konstr_check_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedKrugKonstr[];
}

async function main() {
  console.log(`\n=== check_krug_konstr_update.ts — READ-ONLY POLICY VALIDATION ===\n`);

  const skus = loadSkus();
  console.log(`Loaded ${skus.length} parsed SKU(s) from new Drive source`);

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

  console.log("\nRunning reconcile (read-only)...");
  // nameNormalize: () => "constant" эффективно пропускает name field из comparison.
  // W2-15 stored verbose names ("горячекатаный круг из конструкционной сортовой стали 10")
  // через seed_krug_gk.ts, новый parser выдаёт compact format ("Круг г/к конструкционный 10 Ст20").
  // Identity-relevant поля (slug, diameter, length, steel_grade, dimensions) compared
  // строго — name отличается только display-формой (false positive metadata conflict).
  const result: ReconcileResult = await reconcile(skus, supabase, {
    supplierId: SUPPLIER_ID,
    priceEpsilonRub: 0.01,
    nameNormalize: () => "skip-name-comparison",
  });

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new (no DB match):              ${result.new.length}`);
  console.log(`  identicalDupes (full match):    ${result.identicalDupes.length}`);
  console.log(`  priceChanges (metadata match): ${result.priceChanges.length}`);
  console.log(`  metadataConflicts (slug clash): ${result.metadataConflicts.length}`);

  // Save reconcile markdown for embedding в REPORT
  const reportPath = resolve(__dirname, "data", "krug_konstr_check_reconcile.md");
  writeFileSync(reportPath, formatReconcileMarkdown(result), "utf-8");
  console.log(`\n  reconcile markdown → ${reportPath}`);

  // Output detailed stats
  if (result.priceChanges.length > 0) {
    console.log(`\n=== Price changes (top 30) — POLICY: NOT applied ===`);
    console.log(`  ${"slug".padEnd(35)} ${"unit".padEnd(5)} ${"old".padStart(10)} ${"new".padStart(10)} ${"diff%".padStart(8)}`);
    for (const pc of result.priceChanges.slice(0, 30)) {
      console.log(
        `  ${pc.slug.padEnd(35)} ${pc.unit.padEnd(5)} ${String(pc.old).padStart(10)} ${String(pc.new).padStart(10)} ${pc.diff_pct.toFixed(2).padStart(7)}%`,
      );
    }
    if (result.priceChanges.length > 30) {
      console.log(`  ... (+${result.priceChanges.length - 30} more)`);
    }
  }

  if (result.metadataConflicts.length > 0) {
    console.log(`\n=== Metadata conflicts (escalation needed) ===`);
    for (const mc of result.metadataConflicts.slice(0, 10)) {
      console.log(`  slug: ${mc.slug}`);
      console.log(`    diff_fields: ${mc.diff_fields.join(", ")}`);
    }
  }

  if (result.new.length > 0) {
    console.log(`\n=== New SKUs (potentially missing from W2-15 catalog) ===`);
    for (const n of (result.new as ParsedKrugKonstr[]).slice(0, 20)) {
      console.log(`  ${n.slug.padEnd(35)} | ${n.steel_grade} | D=${n.diameter} | ${n.prices[0].base_price} ₽/т`);
    }
    if (result.new.length > 20) {
      console.log(`  ... (+${result.new.length - 20} more)`);
    }
  }

  // ============================================================================
  // SEED new bucket only — if --commit flag and only-new (no conflicts/changes)
  // ============================================================================
  const isCommit = process.argv.includes("--commit");
  if (
    isCommit &&
    result.new.length > 0 &&
    result.priceChanges.length === 0 &&
    result.metadataConflicts.length === 0
  ) {
    const CATEGORY_ID = "1e06974a-8c7c-41a2-9b64-56a276dcc930";
    const MARKUP_PCT = 9.0;
    const CURRENCY = "RUB";

    console.log(`\n=== Seeding ${result.new.length} new SKU(s) (per ТЗ #014 Step 4) ===\n`);
    let productsInserted = 0;
    let pricesInserted = 0;
    const errors: string[] = [];

    for (const sku of result.new as ParsedKrugKonstr[]) {
      const productRow = {
        name: sku.name,
        slug: sku.slug,
        category_id: CATEGORY_ID,
        diameter: sku.diameter,
        length: null,
        steel_grade: sku.steel_grade,
        dimensions: null,
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
        errors.push(`[${sku.slug}] insert: ${insErr?.message ?? "no row"}`);
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
          errors.push(`[${sku.slug}/${p.unit}] price: ${pInsErr.message}`);
          continue;
        }
        pricesInserted++;
      }
    }

    console.log(`  products inserted: ${productsInserted}`);
    console.log(`  price_items inserted: ${pricesInserted}`);
    if (errors.length > 0) {
      console.log(`\n  ❌ ${errors.length} errors:`);
      errors.forEach((e) => console.log(`     ${e}`));
      process.exit(1);
    }
    console.log(`\n  ✅ Seed complete.`);
  } else {
    console.log(`\n  ✅ Read-only check complete. NO database changes made.`);
    console.log(`  Per POLICY (lesson 075): priceChanges/conflicts → REPORT only, escalate.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

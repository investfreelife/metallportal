/**
 * Seed для Нержавейка mega — wave W2-26 #i008 (catalog-images).
 *
 * Source: scripts/data/nerz_mega_skus.json (~565 SKU после dedup из 616 raw).
 *   - 380 круг никельсодержащий (krug-nerzhaveyuschiy-nikel L3, existing 166)
 *   - 140 круг безникелевый жаропрочный (krug-zharoprochnyy L3, existing 142)
 *   - 43 шестигранник никельсодержащий (NEW L3 shestigrannik-nerzhaveyuschiy-nikel)
 *   - 2 шестигранник безникелевый жаропрочный (NEW L3 shestigrannik-zharoprochnyy)
 *
 * Reconcile expectation: existing 308 circle SKUs (Кирилл/Иван) могут overlap.
 * Bucket-sort разрулит: identicalDupes / new / priceChanges (no auto-update).
 *
 * Multi-unit ₽/м primary + ₽/т secondary.
 *
 * Usage:
 *   npx tsx scripts/seed_nerz_mega.ts             # dry-run reconcile
 *   npx tsx scripts/seed_nerz_mega.ts --commit
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

type ParsedNerzMega = ParsedSku & {
  category_slug: string;
  category_id: string;
  primary_unit: string;
};

function loadSkus(): ParsedNerzMega[] {
  const path = resolve(__dirname, "data", "nerz_mega_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedNerzMega[];
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_nerz_mega.ts — ${mode} ===\n`);

  const skus = loadSkus();
  console.log(`Loaded ${skus.length} parsed SKU(s)`);

  if (new Set(skus.map((s) => s.slug)).size !== skus.length) {
    console.error(`❌ Slug collision in parsed`);
    process.exit(1);
  }

  const byCat = new Map<string, number>();
  for (const s of skus) byCat.set(s.category_slug, (byCat.get(s.category_slug) ?? 0) + 1);
  console.log("\nDistribution:");
  for (const [k, v] of byCat) console.log(`  ${k}: ${v}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  console.log("\nRunning reconcile (chunked)...");
  const RECONCILE_CHUNK = 200;
  const result: ReconcileResult = {
    new: [],
    identicalDupes: [],
    priceChanges: [],
    metadataConflicts: [],
  };
  for (let i = 0; i < skus.length; i += RECONCILE_CHUNK) {
    const chunk = skus.slice(i, i + RECONCILE_CHUNK);
    const sub = await reconcile(chunk, supabase, {
      supplierId: SUPPLIER_ID,
      priceEpsilonRub: 0.01,
    });
    result.new.push(...sub.new);
    result.identicalDupes.push(...sub.identicalDupes);
    result.priceChanges.push(...sub.priceChanges);
    result.metadataConflicts.push(...sub.metadataConflicts);
  }

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new:                ${result.new.length}`);
  console.log(`  identicalDupes:     ${result.identicalDupes.length}`);
  console.log(`  priceChanges:       ${result.priceChanges.length}`);
  console.log(`  metadataConflicts:  ${result.metadataConflicts.length}`);

  const reportPath = resolve(__dirname, "data", "nerz_mega_reconcile.md");
  writeFileSync(reportPath, formatReconcileMarkdown(result), "utf-8");

  // Per ТЗ #i008: metadataConflicts → escalate в REPORT, NOT auto-update.
  // Allow seed 414 new + skip 151 conflict (escalation written в reconcile.md).
  // priceChanges — strict stop (POLICY).
  if (result.metadataConflicts.length > 0) {
    console.warn(
      `\n⚠ ${result.metadataConflicts.length} metadata conflicts — escalating in reconcile.md, ` +
      `proceeding с ${result.new.length} new SKUs only.`,
    );
  }
  if (result.priceChanges.length > 0) {
    console.error(`\n⚠ price changes detected — STOP per POLICY`);
    process.exit(1);
  }

  console.log(`\nProceeding with ${result.new.length} new SKU(s).`);

  if (!isCommit) {
    for (const s of (result.new as ParsedNerzMega[]).slice(0, 5)) {
      const priceStr = s.prices.length
        ? `${s.prices[0].base_price} ₽/${s.prices[0].unit}`
        : "(no price)";
      console.log(`  ${s.slug.padEnd(60)} | ${priceStr}`);
    }
    console.log("\nDry-run complete.");
    return;
  }

  let productsInserted = 0;
  let pricesInserted = 0;
  const errors: string[] = [];

  const BATCH = 80;
  const newSkus = result.new as ParsedNerzMega[];
  for (let i = 0; i < newSkus.length; i += BATCH) {
    const batch = newSkus.slice(i, i + BATCH);
    const productRows = batch.map((sku) => ({
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
      errors.push(`batch ${i}: insert products: ${insErr?.message ?? "no rows"}`);
      continue;
    }
    productsInserted += inserted.length;

    const slugToId = new Map<string, string>(inserted.map((p) => [p.slug, p.id]));
    const priceRows: Array<Record<string, unknown>> = [];
    for (const sku of batch) {
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
        errors.push(`batch ${i}: insert price_items: ${pInsErr.message}`);
      } else {
        pricesInserted += priceRows.length;
      }
    }
  }

  console.log(`\n=== Commit summary ===`);
  console.log(`  products inserted: ${productsInserted}`);
  console.log(`  price_items inserted: ${pricesInserted}`);
  if (errors.length > 0) {
    console.log(`\n  ❌ ${errors.length} errors:`);
    errors.slice(0, 10).forEach((e) => console.log(`     ${e}`));
    process.exit(1);
  }
  console.log(`\n  ✅ all rows processed cleanly`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

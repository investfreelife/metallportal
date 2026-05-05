/**
 * Seed для ВГП, электросварные трубы (W2-25, multi-target).
 *
 * Source: scripts/data/vgp_truby_skus.json (547 unique SKUs across 4 L2 categories).
 *
 * Multi-target classifier (4 buckets):
 *   vgp-elektrosvarnye-truby:               ~459 SKUs (ВГП черные + ЭСВ круглые)
 *   truby-otsinkovannye:                    ~50 SKUs (оцинкованные variants)
 *   truby-profilnye (NEW L2):                ~32 SKUs (квадратные/прямоугольные/плоскоовальные)
 *   truby-elektrosvarnye-nizkolegirovannye:  ~6 SKUs (09Г2С большие диаметры)
 *
 * Single-unit ₽/т (volume-tier identity → MIN per lesson 083).
 *
 * Pipeline через lib/raw-import-reconcile.ts (POLICY compliance).
 *
 * Usage:
 *   npx tsx scripts/seed_vgp_truby.ts             # dry-run
 *   npx tsx scripts/seed_vgp_truby.ts --commit
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

type ParsedTruba = ParsedSku & {
  category_slug: string;
  category_id: string;
  primary_unit: string;
};

function loadSkus(): ParsedTruba[] {
  const path = resolve(__dirname, "data", "vgp_truby_skus.json");
  return JSON.parse(readFileSync(path, "utf-8")) as ParsedTruba[];
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_vgp_truby.ts — ${mode} ===\n`);

  const skus = loadSkus();
  console.log(`Loaded ${skus.length} parsed SKU(s) across categories:`);
  const byCategory: Record<string, number> = {};
  for (const s of skus) byCategory[s.category_slug] = (byCategory[s.category_slug] ?? 0) + 1;
  for (const [c, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(42)} → ${n}`);
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

  console.log(`\nRunning reconcile (chunked by 100) across ${skus.length} SKUs...`);
  // Chunk skus by 100 to avoid PostgREST URL length limit on .in() clause
  const CHUNK_SIZE = 100;
  const result: ReconcileResult = {
    new: [], identicalDupes: [], priceChanges: [], metadataConflicts: [],
  };
  for (let i = 0; i < skus.length; i += CHUNK_SIZE) {
    const chunk = skus.slice(i, i + CHUNK_SIZE);
    const chunkResult = await reconcile(chunk, supabase, {
      supplierId: SUPPLIER_ID,
      priceEpsilonRub: 0.01,
    });
    result.new.push(...chunkResult.new);
    result.identicalDupes.push(...chunkResult.identicalDupes);
    result.priceChanges.push(...chunkResult.priceChanges);
    result.metadataConflicts.push(...chunkResult.metadataConflicts);
    process.stdout.write(`  chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(skus.length / CHUNK_SIZE)} done\r`);
  }
  console.log("");

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new:                ${result.new.length}`);
  console.log(`  identicalDupes:     ${result.identicalDupes.length}`);
  console.log(`  priceChanges:       ${result.priceChanges.length}`);
  console.log(`  metadataConflicts:  ${result.metadataConflicts.length}`);

  const reportPath = resolve(__dirname, "data", "vgp_truby_reconcile.md");
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
    for (const s of (result.new as ParsedTruba[]).slice(0, 5)) {
      console.log(`  ${s.slug.padEnd(60)} | ${s.category_slug.padEnd(40)} | ${s.prices[0].base_price} ₽/т`);
    }
    console.log("\nDry-run complete.");
    return;
  }

  let productsInserted = 0;
  let pricesInserted = 0;
  const errors: string[] = [];

  for (const sku of result.new as ParsedTruba[]) {
    const productRow = {
      name: sku.name,
      slug: sku.slug,
      category_id: sku.category_id,
      diameter: (sku as any).diameter ?? null,
      thickness: (sku as any).thickness ?? null,
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

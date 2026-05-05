/**
 * Seed для Цветмет (ТЗ #s002, Кирилл/mc-scraper).
 *
 * Source: scripts/data/tsvetmet-articles.json (2230 SKU).
 *
 * Buckets:
 *  - 2221 articles → 30 новых L3 под existing tsvetnye-metally L1 (migration 20260521000000)
 *  - 9 нихромовых → existing provoloka-nikhromovaya под metizy (Q5 confirmed: 100% slug overlap;
 *    идут в metadataConflicts на dimensions diff — POLICY: no auto-update existing data)
 *
 * Pipeline через lib/raw-import-reconcile.ts (POLICY compliance).
 *
 * Usage:
 *   npx tsx scripts/seed_tsvetmet.ts             # dry-run
 *   npx tsx scripts/seed_tsvetmet.ts --commit
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

const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001"; // Convention из всех seed_*.ts (МеталлСтрой)
const MARKUP_PCT = 9.0;
const CURRENCY = "RUB";
const ARTICLES_JSON = resolve(__dirname, "data", "tsvetmet-articles.json");

type RawArticle = {
  slug: string;
  name: string;
  category_slug: string;
  l2_slug: string;
  l1_slug: string;
  kind_slug: string;
  metal_group: string | null;
  dimensions: Record<string, unknown>;
  steel_grade: string | null;
  length: number | null;
  size_raw: string;
  size_token: string;
  prices: Array<{ unit: string; base_price: number }>;
  source_url: string;
  external_id: string | null;
  scraped_at: string;
};

const SHEET_KINDS = new Set(["list", "list-riflenyy", "list-pvl", "plita", "lenta", "folga", "shina"]);
const ROUND_KINDS = new Set(["krug", "kvadrat", "shestigrannik", "provoloka", "chushka"]);

function parseSizeToken(token: string): number[] {
  return token
    .split(/[xх]/i)
    .map((s) => parseFloat(s))
    .filter((n) => !Number.isNaN(n));
}

function inferDims(art: RawArticle): { diameter: number | null; thickness: number | null } {
  const dims = parseSizeToken(art.size_token);
  if (dims.length === 0) return { diameter: null, thickness: null };
  if (SHEET_KINDS.has(art.kind_slug)) return { diameter: null, thickness: dims[0] ?? null };
  if (ROUND_KINDS.has(art.kind_slug)) return { diameter: dims[0] ?? null, thickness: null };
  if (art.kind_slug === "truba") {
    if (dims.length >= 2) return { diameter: dims[0], thickness: dims[dims.length - 1] };
    return { diameter: dims[0] ?? null, thickness: null };
  }
  return { diameter: null, thickness: null };
}

function primaryUnit(prices: Array<{ unit: string; base_price: number }>): string {
  if (prices.length === 0) return "шт";
  const u = prices[0].unit;
  if (u === "руб/кг" || u === "руб/кг_tier") return "кг";
  if (u === "руб/шт") return "шт";
  if (u === "руб/м") return "м";
  if (u === "руб/м2") return "м²";
  if (u === "руб/т") return "т";
  if (u === "шт" || u === "кг" || u === "м" || u === "м²" || u === "т") return u;
  if (u === "кг_tier") return "кг";
  return "шт";
}

function priceUnitToken(internal: string): string {
  if (internal === "руб/кг_tier") return "кг_tier";
  if (internal === "руб/кг") return "кг";
  if (internal === "руб/шт") return "шт";
  if (internal === "руб/м") return "м";
  if (internal === "руб/м2") return "м²";
  if (internal === "руб/т") return "т";
  return internal;
}

async function fetchCategoryIdMap(
  supabase: ReturnType<typeof createClient>,
  slugs: string[],
): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("categories").select("id, slug").in("slug", slugs);
  if (error) throw new Error(`fetch categories: ${error.message}`);
  return new Map((data ?? []).map((r: any) => [r.slug as string, r.id as string]));
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";
  console.log(`\n=== seed_tsvetmet.ts — ${mode} ===\n`);

  const articles = JSON.parse(readFileSync(ARTICLES_JSON, "utf-8")) as RawArticle[];
  console.log(`Loaded ${articles.length} parsed articles`);

  const slugSet = new Set(articles.map((a) => a.slug));
  if (slugSet.size !== articles.length) {
    console.error(`❌ Slug collision in parsed JSON (${articles.length - slugSet.size} dups)`);
    process.exit(1);
  }

  const uniqueCatSlugs = Array.from(new Set(articles.map((a) => a.category_slug)));
  console.log(`Unique L3 categories: ${uniqueCatSlugs.length}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  const catMap = await fetchCategoryIdMap(supabase, uniqueCatSlugs);
  const missing = uniqueCatSlugs.filter((s) => !catMap.has(s));
  if (missing.length > 0) {
    console.error(`❌ Missing categories in БД: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`✅ All ${uniqueCatSlugs.length} L3 categories resolved`);

  const parsedSkus: ParsedSku[] = articles.map((a) => {
    const dims = inferDims(a);
    return {
      slug: a.slug,
      name: a.name,
      category_slug: a.category_slug,
      category_id: catMap.get(a.category_slug),
      diameter: dims.diameter,
      thickness: dims.thickness,
      length: a.length,
      steel_grade: a.steel_grade,
      dimensions: a.dimensions,
      prices: a.prices.map((p) => ({ unit: priceUnitToken(p.unit), base_price: p.base_price })),
    };
  });

  // Chunked reconcile: Supabase REST URL limit ~8K char, 2230 slugs * ~30 char = ~67K → нужно chunking.
  console.log("\nRunning reconcile (chunked, 200 SKU/chunk)...");
  const CHUNK = 200;
  const result: ReconcileResult = {
    new: [], identicalDupes: [], priceChanges: [], metadataConflicts: [],
  };
  for (let i = 0; i < parsedSkus.length; i += CHUNK) {
    const slice = parsedSkus.slice(i, i + CHUNK);
    const r = await reconcile(slice, supabase, {
      supplierId: SUPPLIER_ID,
      priceEpsilonRub: 0.01,
    });
    result.new.push(...r.new);
    result.identicalDupes.push(...r.identicalDupes);
    result.priceChanges.push(...r.priceChanges);
    result.metadataConflicts.push(...r.metadataConflicts);
    process.stdout.write(`  chunk ${Math.floor(i / CHUNK) + 1}/${Math.ceil(parsedSkus.length / CHUNK)}: +${r.new.length} new, +${r.identicalDupes.length} dupes, +${r.priceChanges.length} priceChanges, +${r.metadataConflicts.length} conflicts\n`);
  }

  console.log(`\n=== Reconcile result ===`);
  console.log(`  new:                ${result.new.length}`);
  console.log(`  identicalDupes:     ${result.identicalDupes.length}`);
  console.log(`  priceChanges:       ${result.priceChanges.length}`);
  console.log(`  metadataConflicts:  ${result.metadataConflicts.length}`);

  const reportPath = resolve(__dirname, "data", "tsvetmet_reconcile.md");
  writeFileSync(reportPath, formatReconcileMarkdown(result), "utf-8");
  console.log(`Reconcile report → ${reportPath}`);

  if (result.metadataConflicts.length > 0) {
    console.error(`\n⚠ ${result.metadataConflicts.length} metadata conflicts — flagged in report. Continuing with new bucket only.`);
  }
  if (result.priceChanges.length > 0) {
    console.error(`\n⚠ ${result.priceChanges.length} price changes — flagged in report (no auto-update per POLICY).`);
  }

  console.log(`\nProceeding with ${result.new.length} new SKU(s).`);

  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));

  if (!isCommit) {
    console.log(`\n=== Sample new (first 5): ===`);
    for (const s of result.new.slice(0, 5)) {
      const a = articleBySlug.get(s.slug)!;
      const u = primaryUnit(s.prices);
      const pricesStr = s.prices.map((p) => `${p.base_price} ₽/${p.unit}`).join(" | ");
      console.log(`  ${s.slug.padEnd(50)} | unit=${u.padEnd(3)} | d=${s.diameter ?? "-"} t=${s.thickness ?? "-"} L=${s.length ?? "-"} | ${pricesStr}`);
    }
    if (result.new.length > 5) console.log(`  ... (${result.new.length - 5} more)`);
    console.log("\nDry-run complete. Re-run with --commit to apply.");
    return;
  }

  // ===== COMMIT =====
  let productsInserted = 0;
  let pricesInserted = 0;
  const errors: string[] = [];

  for (const sku of result.new) {
    const art = articleBySlug.get(sku.slug);
    if (!art) {
      errors.push(`[${sku.slug}] no source article`);
      continue;
    }
    const u = primaryUnit(sku.prices);
    const productRow = {
      name: sku.name,
      slug: sku.slug,
      category_id: catMap.get(art.category_slug),
      supplier_id: SUPPLIER_ID,
      diameter: sku.diameter,
      thickness: sku.thickness,
      length: sku.length,
      steel_grade: sku.steel_grade,
      dimensions: typeof sku.dimensions === "object" ? JSON.stringify(sku.dimensions) : sku.dimensions,
      unit: u,
      material: art.metal_group ?? null,
      article: art.external_id ?? null,
      source_url: art.source_url,
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
  console.log(`  products inserted:    ${productsInserted}`);
  console.log(`  price_items inserted: ${pricesInserted}`);
  if (errors.length > 0) {
    console.log(`\n  ❌ ${errors.length} errors:`);
    errors.slice(0, 20).forEach((e) => console.log(`     ${e}`));
    if (errors.length > 20) console.log(`     ... (+${errors.length - 20} more)`);
    process.exit(1);
  }
  console.log(`\n  ✅ all rows processed cleanly`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

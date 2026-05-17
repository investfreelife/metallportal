/**
 * Generate OpenAI embeddings (text-embedding-3-small, 1536 dim) for all
 * products and store in `products.embedding` (#c007 Block 1).
 *
 * Requires (env):
 *   - OPENAI_API_KEY                 (loaded from harlan-ai/.env if not in metallportal/.env.local)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Behaviour:
 *   - Resume-safe: skips products that already have embedding set.
 *   - Tracks jobs in `products_embedding_jobs` (status: pending → processing → done/failed).
 *   - Batches 100 products with 1-sec inter-batch sleep (OpenAI tier-1 limits OK).
 *   - Embedding text = `name | steel_grade | dimensions | category_name`.
 *   - Idempotent: per-product UNIQUE(product_id, embedding_model) — repeat call upserts.
 *
 * Usage:
 *   npx tsx scripts/generate_product_embeddings.ts          # processes all rows missing embedding
 *   npx tsx scripts/generate_product_embeddings.ts --limit=500
 *   npx tsx scripts/generate_product_embeddings.ts --dry-run
 *
 * Cost (text-embedding-3-small @ $0.02/1M tokens, ~5K SKU × ~500 tokens avg):
 *   ≈ $0.05 total run.
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";
import { readFileSync } from "fs";
import OpenAI from "openai";

loadEnvConfig(resolve(__dirname, ".."));

// Fallback: pull OPENAI_API_KEY from harlan-ai/.env if absent in metallportal env.
// Pull both OPENAI_API_KEY and OPENAI_API_BASE from harlan-ai/.env if absent here.
// In this project the "OPENAI_API_KEY" is actually an OpenRouter routing key
// (`sk-or-v1...`), and OPENAI_API_BASE points to OpenRouter — so we explicitly
// thread baseURL into the OpenAI client and prefix the model with `openai/`.
if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_BASE) {
  try {
    const harlanEnv = readFileSync(
      resolve(__dirname, "..", "..", "harlan-ai", ".env"),
      "utf-8"
    );
    if (!process.env.OPENAI_API_KEY) {
      const k = harlanEnv.match(/^OPENAI_API_KEY=(.+)$/m);
      if (k) process.env.OPENAI_API_KEY = k[1].replace(/^["']|["']$/g, "").trim();
    }
    if (!process.env.OPENAI_API_BASE) {
      const b = harlanEnv.match(/^OPENAI_API_BASE=(.+)$/m);
      if (b) process.env.OPENAI_API_BASE = b[1].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* harlan-ai .env not accessible — script will fail loudly below */ }
}

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY not set. Add to env or harlan-ai/.env.");
  process.exit(1);
}

const isOpenRouter =
  (process.env.OPENAI_API_BASE ?? "").includes("openrouter.ai") ||
  (process.env.OPENAI_API_KEY ?? "").startsWith("sk-or-");
const EMBEDDING_MODEL = isOpenRouter
  ? "openai/text-embedding-3-small"
  : "text-embedding-3-small";
const BATCH_SIZE = 100;
const INTER_BATCH_SLEEP_MS = 1000;
const MAX_INPUT_CHARS = 8000; // OpenAI hard limit ~8191 tokens; chars ≈ tokens × 4.

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  steel_grade: string | null;
  dimensions: string | null;
  category_id: string;
  category_name?: string | null;
};

function buildInputText(p: ProductRow): string {
  const parts: string[] = [p.name.trim()];
  if (p.steel_grade) parts.push(`Марка: ${p.steel_grade}`);
  if (p.dimensions && p.dimensions.trim() && p.dimensions !== "{}") {
    parts.push(`Размеры: ${p.dimensions}`);
  }
  if (p.category_name) parts.push(`Категория: ${p.category_name}`);
  const joined = parts.join(" | ");
  return joined.length > MAX_INPUT_CHARS ? joined.slice(0, MAX_INPUT_CHARS) : joined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

  console.log(`\n=== generate_product_embeddings.ts ===`);
  console.log(`mode: ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(`model: ${EMBEDDING_MODEL}, batch: ${BATCH_SIZE}, sleep: ${INTER_BATCH_SLEEP_MS}ms`);
  if (isFinite(limit)) console.log(`limit: ${limit} products`);
  console.log("");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...(process.env.OPENAI_API_BASE ? { baseURL: process.env.OPENAI_API_BASE } : {}),
  });

  // Pull all products lacking embedding (paged via range — Supabase REST max 1000/req).
  console.log("Fetching products without embedding...");
  const products: ProductRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, steel_grade, dimensions, category_id, categories(name)")
      .eq("is_active", true)
      .is("embedding", null)
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("fetch error:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    for (const p of data) {
      const cat = (p as { categories?: { name?: string | null } | null }).categories;
      products.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        steel_grade: p.steel_grade,
        dimensions: p.dimensions,
        category_id: p.category_id,
        category_name: cat?.name ?? null,
      });
    }
    if (data.length < PAGE) break;
    if (products.length >= limit) break;
  }

  const target = products.slice(0, isFinite(limit) ? limit : products.length);
  console.log(`Products to embed: ${target.length}`);

  if (isDryRun) {
    console.log("\nDRY-RUN — sample embedding text for first 3 products:");
    for (const p of target.slice(0, 3)) {
      console.log(`  ${p.slug}: "${buildInputText(p)}"`);
    }
    console.log(`\nWould make ${Math.ceil(target.length / BATCH_SIZE)} API calls. Stopping.`);
    return;
  }

  let done = 0;
  let failed = 0;
  for (let i = 0; i < target.length; i += BATCH_SIZE) {
    const batch = target.slice(i, i + BATCH_SIZE);
    const inputs = batch.map(buildInputText);

    // Mark batch as 'processing'
    const jobsBatch = batch.map((p) => ({
      product_id: p.id,
      status: "processing" as const,
      embedding_model: EMBEDDING_MODEL,
      source_text: buildInputText(p),
      started_at: new Date().toISOString(),
    }));
    await supabase
      .from("products_embedding_jobs")
      .upsert(jobsBatch, { onConflict: "product_id,embedding_model" });

    try {
      const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
      });
      if (res.data.length !== batch.length) {
        throw new Error(`expected ${batch.length} embeddings, got ${res.data.length}`);
      }

      // Update products + mark jobs done
      for (let j = 0; j < batch.length; j++) {
        const p = batch[j];
        const vec = res.data[j].embedding;
        const { error: updErr } = await supabase
          .from("products")
          .update({ embedding: vec as unknown as string })
          .eq("id", p.id);
        if (updErr) {
          console.error(`  [FAIL] ${p.slug}: ${updErr.message}`);
          await supabase
            .from("products_embedding_jobs")
            .update({ status: "failed", error: updErr.message })
            .eq("product_id", p.id)
            .eq("embedding_model", EMBEDDING_MODEL);
          failed++;
          continue;
        }
        await supabase
          .from("products_embedding_jobs")
          .update({ status: "done", generated_at: new Date().toISOString(), error: null })
          .eq("product_id", p.id)
          .eq("embedding_model", EMBEDDING_MODEL);
        done++;
      }

      const pct = (((i + batch.length) / target.length) * 100).toFixed(1);
      console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: +${batch.length} (${done} done, ${failed} failed) — ${pct}%`);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? String(e);
      console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1} FAILED: ${msg}`);
      // Mark whole batch as failed
      await supabase
        .from("products_embedding_jobs")
        .update({ status: "failed", error: msg })
        .in(
          "product_id",
          batch.map((p) => p.id)
        )
        .eq("embedding_model", EMBEDDING_MODEL);
      failed += batch.length;
    }

    if (i + BATCH_SIZE < target.length) await sleep(INTER_BATCH_SLEEP_MS);
  }

  console.log(`\n=== DONE === total=${target.length}  done=${done}  failed=${failed}`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});

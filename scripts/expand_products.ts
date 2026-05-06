/**
 * @deprecated since 2026-05-05 — use `scripts/enrich_all.ts` (free model)
 *
 * Pre-c012b one-shot script that expanded short product names через Claude
 * Opus paid model. Replaced by `enrich_all.ts` running on free OpenRouter
 * (LAW-AI-decoupled-from-core: $0 chat cost). Kept в repo as historical
 * reference; does not run in production cron / CI.
 *
 * Don't run this script — оно использует paid Claude key, не free OpenRouter.
 * If you need product enrichment: `npx tsx scripts/enrich_all.ts`.
 *
 * Usage (kept for historical run-recovery only): see git blame.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
const envPath = join(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env.local not found — assume env vars are already set
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Product {
  id: string;
  name: string;
}

interface ProductExpansion {
  full_name: string;
  description: string;
  gost: string;
  application: string;
  steel_grade: string;
}

// ---------------------------------------------------------------------------
// System prompt (cached across all batches)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Ты эксперт по российской металлургии и металлопрокату.
Твоя задача — развернуть короткие технические названия металлопродукции в профессиональные описания.

Для каждого товара верни JSON-объект со следующими полями:
- full_name: Полное профессиональное название товара (на русском, кратко и точно)
- description: 2-3 предложения о продукте — характеристики, свойства, особенности (на русском)
- gost: Применимый ГОСТ или ТУ (например "ГОСТ 8734-75", или "" если неизвестен)
- application: 1-2 предложения о применении — где и как используется (на русском)
- steel_grade: Марка стали, если применимо (например "Ст3сп", "09Г2С", "08кп"), или "" если не применимо

Примеры коротких названий и их расшифровки:
- "ДУ 25 черн 2,5" → труба водогазопроводная (ВГП) ДУ 25 мм, толщина стенки 2,5 мм, чёрная (без покрытия)
- "Арматура А500С ⌀12мм" → арматурный стержень периодического профиля, класс А500С, диаметр 12 мм
- "Труба профильная 40×40×2" → профильная труба квадратного сечения 40×40 мм, толщина стенки 2 мм
- "Лист г/к 3мм" → горячекатаный стальной лист толщиной 3 мм

Отвечай ТОЛЬКО JSON-массивом — без каких-либо пояснений, обёрток или markdown. Порядок объектов должен совпадать с порядком входных товаров.`;

// ---------------------------------------------------------------------------
// Expand one batch of up to 20 products
// ---------------------------------------------------------------------------
async function expandBatch(
  products: Product[]
): Promise<(ProductExpansion | null)[]> {
  const productList = products
    .map((p, i) => `${i + 1}. ${p.name}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Cache the system prompt — it's identical for every batch call
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Разверни следующие ${products.length} товаров по металлопрокату:\n\n${productList}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }

  // Extract JSON array — handle optional markdown fences
  const raw = textBlock.text.trim();
  const jsonStr = raw.startsWith("[")
    ? raw
    : (raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? raw);

  let parsed: ProductExpansion[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse JSON response:", raw.slice(0, 500));
    return products.map(() => null);
  }

  if (!Array.isArray(parsed) || parsed.length !== products.length) {
    console.error(
      `Expected ${products.length} items, got ${parsed?.length}. Raw:`,
      raw.slice(0, 300)
    );
    return products.map(() => null);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Save a batch of expansions to Supabase
// ---------------------------------------------------------------------------
async function saveBatch(
  products: Product[],
  expansions: (ProductExpansion | null)[]
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const expansion = expansions[i];
    if (!expansion) {
      failed++;
      continue;
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: expansion.full_name || products[i].name,
        description: expansion.description || null,
        gost: expansion.gost || null,
        material: expansion.application || null,
        steel_grade: expansion.steel_grade || null,
      })
      .eq("id", products[i].id);

    if (error) {
      console.error(`  ✗ Failed to update ${products[i].id}:`, error.message);
      failed++;
    } else {
      saved++;
    }
  }

  return { saved, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, v] = a.slice(2).split("=");
        return [k, v ?? "true"];
      })
  );

  const limit = args.limit ? parseInt(args.limit) : undefined;
  const offset = args.offset ? parseInt(args.offset) : 0;

  console.log("Fetching products from Supabase...");

  let query = supabase
    .from("products")
    .select("id, name")
    .order("id")
    .range(offset, offset + (limit ?? 9999) - 1);

  const { data: products, error } = await query;
  if (error) throw new Error(`Failed to fetch products: ${error.message}`);
  if (!products?.length) {
    console.log("No products found.");
    return;
  }

  const BATCH_SIZE = 20;
  const total = products.length;
  const batches = Math.ceil(total / BATCH_SIZE);

  console.log(`Found ${total} products → ${batches} batches of ${BATCH_SIZE}\n`);

  let totalSaved = 0;
  let totalFailed = 0;
  let cacheHits = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = products.slice(i, i + BATCH_SIZE);

    process.stdout.write(
      `Batch ${batchNum}/${batches} (${batch.length} products)... `
    );

    try {
      const expansions = await expandBatch(batch);
      const { saved, failed } = await saveBatch(batch, expansions);

      totalSaved += saved;
      totalFailed += failed;

      console.log(`✓ saved=${saved} failed=${failed}`);

      // Rate limit headroom — Opus 4.7 has generous limits but be polite
      if (i + BATCH_SIZE < total) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err) {
      console.error(`✗ batch error:`, err);
      totalFailed += batch.length;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Done.  Saved: ${totalSaved}  Failed: ${totalFailed}  Total: ${total}`);
  if (cacheHits > 0) console.log(`Cache hits: ${cacheHits} (system prompt cached)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

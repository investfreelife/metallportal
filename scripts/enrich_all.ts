/**
 * Enriches metal product names using OpenRouter API (gpt-4o-mini).
 * Generates: full name, description, GOST, steel grade, SEO title/description,
 * application areas, and auto-detects the correct subcategory.
 *
 * Usage:
 *   npx tsx scripts/enrich_all.ts              # all products
 *   npx tsx scripts/enrich_all.ts --limit=50   # first N products
 *   npx tsx scripts/enrich_all.ts --offset=100 # skip first N
 *   npx tsx scripts/enrich_all.ts --dry-run    # print output, don't save
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* env vars set externally */ }

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RawProduct {
  id: string;
  name: string;
  category_slug: string;
}

interface Enriched {
  id: string;
  name: string;               // full professional name
  description: string;        // 2-3 sentence product description
  gost: string;               // e.g. "ГОСТ 8734-75"
  steel_grade: string;        // e.g. "Ст3сп"
  material: string;           // application areas
  seo_title: string;          // <60 chars, for meta title
  seo_description: string;    // ~150 chars, for meta description
  category_slug: string;      // detected subcategory slug (3rd level)
}

// ---------------------------------------------------------------------------
// Category context injected into system prompt
// ---------------------------------------------------------------------------
const CATEGORY_MAP = `
ДОСТУПНЫЕ ПОДКАТЕГОРИИ (slug → название):
Трубы и профиль:
  truba-vgp             → Трубы ВГП (водогазопроводные, ГОСТ 3262-75)
  truba-profilnaya      → Трубы профильные (квадратные, прямоугольные)
  truba-svarnaya        → Трубы электросварные круглые (ГОСТ 10704-91)
  truba-besshovnaya     → Трубы бесшовные (ГОСТ 8734-75)

Арматура и сетка:
  armatura-stalnaya     → Арматура стальная (А500С, А240, А400)
  setka-svarnaya        → Сетка сварная
  setka-kladochnaya     → Сетка кладочная

Балки и швеллеры:
  balka-dvutavr         → Двутавровые балки
  shveller              → Швеллер

Листы и плиты:
  list-goryachekatany   → Лист горячекатаный
  list-holodnokatany    → Лист холоднокатаный
  list-otsinkovanny     → Лист оцинкованный
  list-riflyony         → Лист рифлёный

Уголки и полосы:
  ugolok-ravnopolochny     → Уголок равнополочный
  ugolok-neravnopolochny   → Уголок неравнополочный
  polosa-stalnaya          → Полоса стальная

Если товар не подходит ни под одну подкатегорию — используй родительскую (truby-i-profil, armatura-i-setka, etc.)
`.trim();

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Ты — эксперт по российской металлургии, металлопрокату и SEO для интернет-магазинов.
Твоя задача: обработать список коротких технических названий металлопродукции и вернуть обогащённые данные в формате JSON.

${CATEGORY_MAP}

Для каждого товара сформируй объект с полями:
- name: Полное профессиональное название на русском (точное, без маркетинговых слов)
- description: 2–3 предложения о продукте: характеристики, свойства, особенности производства
- gost: Применимый ГОСТ или ТУ (например "ГОСТ 8734-75"), или "" если неизвестен
- steel_grade: Марка стали (например "Ст3сп", "09Г2С"), или "" если не применимо
- material: Области применения — 1–2 предложения, где используется
- seo_title: SEO-заголовок до 60 символов (название + ключевые характеристики), для тега <title>
- seo_description: SEO-описание ~150 символов для мета-тега description, с ключевыми словами
- category_slug: Slug подкатегории из списка выше, наиболее подходящей для товара

Правила:
1. Отвечай ТОЛЬКО валидным JSON-объектом вида {"items": [...]}
2. Массив items содержит ровно столько объектов, сколько товаров во входных данных
3. Порядок объектов в items совпадает с порядком входных данных
4. Все текстовые поля на русском языке
5. seo_title и seo_description должны содержать ключевые слова для SEO

Примеры расшифровки названий:
- "ДУ 25 черн 2,5" → труба ВГП ДУ 25 мм, стенка 2,5 мм, чёрная → category: truba-vgp
- "Арматура А500С ⌀12мм" → арматурный стержень А500С ⌀12 мм → category: armatura-stalnaya
- "Труба профильная 40×40×2" → профтруба 40×40×2 мм → category: truba-profilnaya
- "Двутавр 10" → двутавровая балка №10 по ГОСТ 8239 → category: balka-dvutavr`;

// ---------------------------------------------------------------------------
// Call OpenRouter for one batch
// ---------------------------------------------------------------------------
async function enrichBatch(products: RawProduct[]): Promise<Enriched[]> {
  const list = products
    .map((p, i) => `${i + 1}. ${p.name}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Обогати следующие ${products.length} товаров по металлопрокату:\n\n${list}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const text = response.choices[0].message.content ?? "";

  let parsed: { items: Omit<Enriched, "id">[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("\nJSON parse error. Raw response:\n", text.slice(0, 600));
    throw new Error("Failed to parse response as JSON");
  }

  const items = parsed.items;
  if (!Array.isArray(items) || items.length !== products.length) {
    throw new Error(
      `Expected ${products.length} items in response.items, got ${items?.length ?? "unknown"}`
    );
  }

  return items.map((item, i) => ({ id: products[i].id, ...item }));
}

// ---------------------------------------------------------------------------
// Resolve category slug → ID
// ---------------------------------------------------------------------------
async function buildCategoryIndex(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug");
  if (error) throw error;
  return new Map(data.map((c) => [c.slug, c.id]));
}

// ---------------------------------------------------------------------------
// Save enriched batch to Supabase
// ---------------------------------------------------------------------------
async function saveBatch(
  enriched: Enriched[],
  categoryIndex: Map<string, string>,
  dryRun: boolean
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;

  for (const item of enriched) {
    const categoryId = categoryIndex.get(item.category_slug);

    if (dryRun) {
      console.log(`\n  [DRY RUN] ${item.id}`);
      console.log(`    name:        ${item.name}`);
      console.log(`    gost:        ${item.gost}`);
      console.log(`    steel_grade: ${item.steel_grade}`);
      console.log(`    category:    ${item.category_slug} (${categoryId ?? "NOT FOUND"})`);
      console.log(`    seo_title:   ${item.seo_title}`);
      console.log(`    description: ${item.description.slice(0, 80)}...`);
      saved++;
      continue;
    }

    const { error } = await supabase
      .from("products")
      .update({
        name:            item.name,
        description:     item.description,
        gost:            item.gost || null,
        steel_grade:     item.steel_grade || null,
        material:        item.material || null,
        ...(categoryId ? { category_id: categoryId } : {}),
      })
      .eq("id", item.id);

    if (error) {
      console.error(`\n  ✗ ${item.id}: ${error.message}`);
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

  const limit      = args.limit    ? parseInt(args.limit)    : undefined;
  const offset     = args.offset   ? parseInt(args.offset)   : 0;
  const dryRun     = args["dry-run"] === "true";
  const failedOnly = args["failed-only"] === "true";
  const BATCH      = 15;

  if (dryRun) console.log("🔍 DRY RUN — nothing will be written to DB\n");
  if (failedOnly) console.log("🔁 FAILED-ONLY — re-processing products with no gost AND no steel_grade\n");

  console.log("Building category index...");
  const categoryIndex = await buildCategoryIndex();
  console.log(`  ${categoryIndex.size} categories loaded\n`);

  console.log("Fetching products...");
  let query = supabase
    .from("products")
    .select("id, name, category:categories(slug)")
    .order("id");

  if (failedOnly) {
    query = query.is("gost", null).is("steel_grade", null);
  } else {
    const end = offset + (limit ?? 99999) - 1;
    query = query.range(offset, end);
  }

  const { data: products, error } = await query;

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!products?.length) { console.log("No products found."); return; }

  const rows: RawProduct[] = products.map((p: any) => ({
    id:            p.id,
    name:          p.name,
    category_slug: p.category?.slug ?? "",
  }));

  const total  = rows.length;
  const batchCount = Math.ceil(total / BATCH);
  console.log(`Found ${total} products → ${batchCount} batches of ${BATCH}\n`);

  let totalSaved = 0;
  let totalFailed = 0;

  for (let i = 0; i < total; i += BATCH) {
    const batchNum = Math.floor(i / BATCH) + 1;
    const batch    = rows.slice(i, i + BATCH);

    process.stdout.write(`Batch ${batchNum}/${batchCount} (${batch.length} items)...`);

    try {
      const enriched = await enrichBatch(batch);
      const { saved, failed } = await saveBatch(enriched, categoryIndex, dryRun);
      totalSaved  += saved;
      totalFailed += failed;
      console.log(` ✓ saved=${saved} failed=${failed}`);
    } catch (err) {
      console.error(` ✗ batch error:`, (err as Error).message);
      totalFailed += batch.length;
    }

    // Brief pause between batches to stay within rate limits
    if (i + BATCH < total) await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n${"─".repeat(55)}`);
  console.log(`Done.  Saved: ${totalSaved}  Failed: ${totalFailed}  Total: ${total}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

/**
 * Generates SEO product cards using OpenRouter gpt-4o-mini.
 * For each product generates:
 *   - seo_title (60 chars)
 *   - seo_description (155 chars)
 *   - seo_text (full card ~400 words, HTML)
 *   - article (артикул MP-{CAT}-{NUM})
 *
 * Uses cache_control on system prompt = 90% savings after first batch.
 * Cost: ~$0.001 per product, 12166 products ≈ $12 total.
 *
 * Usage:
 *   npx tsx scripts/generate_cards.ts              # all without seo_text
 *   npx tsx scripts/generate_cards.ts --limit=100  # first N
 *   npx tsx scripts/generate_cards.ts --offset=500 # skip first N
 *   npx tsx scripts/generate_cards.ts --dry-run    # print, don't save
 *   npx tsx scripts/generate_cards.ts --category=truby-vgp  # one category
 */

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
// Config
// ---------------------------------------------------------------------------
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY is not set in .env.local");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Category slug → article code mapping
// ---------------------------------------------------------------------------
const SLUG_TO_CODE: Record<string, string> = {
  "truby-vgp": "VGP",
  "truby-besshovnye": "BSH",
  "truby-es": "ES",
  "truby-profilnye": "PROF",
  "truby-ocinkovanye": "OCTR",
  "truby-i-profil": "TRB",
  "armatura-a500": "A500",
  "armatura-a240": "A240",
  "armatura-i-setka": "ARM",
  "setka-svarnaya": "SSV",
  "setka-kladochnaya": "SKL",
  "list-gk": "LGK",
  "list-hk": "LHK",
  "list-ocink": "LOC",
  "list-nerzh": "LNR",
  "list-riflyonyj": "LRF",
  "listovoj-prokat": "LST",
  "ugolok": "UG",
  "shveller": "SHV",
  "balka": "BLK",
  "fasonnyj-prokat": "FAS",
  "sortovoj-prokat": "SRT",
  "polosa-stalnaya": "POL",
  "krug-stalnoj": "KRG",
  "kvadrat-stalnoj": "KVD",
  "shestigrannik": "SHG",
  "prof-okrash": "PFO",
  "prof-ocink": "PFC",
  "profnastil": "PFN",
  "sendvich-st": "SNS",
  "sendvich-kr": "SNK",
  "nerzhaveika": "NRZ",
  "nerzh-list": "NRL",
  "nerzh-truba": "NRT",
  "nerzh-krug": "NRK",
  "nerzh-provoloka": "NRP",
  "alyuminij": "ALU",
  "med-latun": "MED",
  "bronza": "BRZ",
  "titan": "TTN",
  "cvetnoj-metall": "CVM",
  "metizy-krepezh": "MTZ",
  "ankery": "ANK",
  "bolty-gajki": "BLG",
  "shpilki": "SHP",
  "samorezy": "SMR",
  "kachestvennyj": "KAC",
  "krug-konstr": "KRK",
  "legirovannaya": "LEG",
  "instrument": "INS",
  "inzhenernye": "INZ",
  "flancy": "FLN",
  "krany": "KRN",
  "zadvizhki": "ZDV",
  "fitingi": "FIT",
};

// ---------------------------------------------------------------------------
// Read SEO rules from docs
// ---------------------------------------------------------------------------
function loadSeoRules(): string {
  try {
    return readFileSync(join(process.cwd(), "docs/SEO_RULES.md"), "utf-8");
  } catch {
    console.warn("⚠ docs/SEO_RULES.md not found, using built-in rules");
    return "";
  }
}

// ---------------------------------------------------------------------------
// System prompt (cached across batches)
// ---------------------------------------------------------------------------
function buildSystemPrompt(seoRules: string): string {
  return `Ты — SEO-копирайтер интернет-магазина металлопроката МеталлПортал (metallportal.vercel.app).
Генерируй контент для карточек товаров на русском языке.

${seoRules}

Для каждого товара из входного списка сформируй JSON-объект с полями:
- seo_title: SEO заголовок для <title>, СТРОГО до 60 символов. Формат: "{Название} купить в Москве | МеталлПортал"
- seo_description: Мета-описание, СТРОГО до 155 символов. Формат: "Купить {название} по цене от {цена} ₽/{ед}. Склад в Москве. Доставка по РФ. Сертификаты."
- seo_text: Полный SEO текст карточки товара в формате HTML (400-500 слов). Структура:
  <h2>{Название} — купить по выгодной цене</h2>
  <p>Описание товара: что это, характеристики, ГОСТ, применение (2-3 абзаца).</p>
  <h3>Характеристики</h3>
  <table>...(ключевые параметры из входных данных)...</table>
  <h3>Как купить {название} в МеталлПортал</h3>
  <p>Оформите заказ на сайте или позвоните. Доставка по Москве и всей России. Самовывоз со склада: г. Москва, Походный проезд, 16. Работаем Пн-Пт 8:00-20:00, Сб 9:00-17:00.</p>
  <h3>Почему МеталлПортал</h3>
  <ul><li>Собственный склад в Москве</li><li>Сертификаты качества на всю продукцию</li><li>Оптовые и розничные цены</li><li>Резка в размер, доставка по РФ</li></ul>

Правила:
1. Отвечай ТОЛЬКО валидным JSON: {"items": [...]}
2. Количество объектов в items = количеству товаров во входных данных
3. Порядок объектов совпадает с порядком входных данных
4. Все тексты на русском языке
5. seo_text — валидный HTML, без обёрток <html>/<body>, только контент
6. Используй конкретные характеристики товара (ГОСТ, размеры, марка стали) из входных данных
7. Ключевые слова для SEO: "купить", "цена", "в Москве", "со склада", "ГОСТ", "{название} оптом"
8. Не выдумывай цены — пиши "по запросу" или "уточняйте"`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProductRow {
  id: string;
  name: string;
  slug: string;
  gost: string | null;
  steel_grade: string | null;
  dimensions: string | null;
  diameter: number | null;
  thickness: number | null;
  length: number | null;
  unit: string;
  coating: string | null;
  weight_per_meter: number | null;
  category_slug: string;
  best_price: number | null;
}

interface GeneratedCard {
  seo_title: string;
  seo_description: string;
  seo_text: string;
}

// ---------------------------------------------------------------------------
// Article counter (per category code)
// ---------------------------------------------------------------------------
const articleCounters: Map<string, number> = new Map();

async function initArticleCounters() {
  // Get max existing article numbers per category code
  const { data } = await supabase
    .from("products")
    .select("article")
    .not("article", "is", null);

  if (data) {
    for (const row of data) {
      const match = (row.article as string).match(/^MP-([A-Z0-9]+)-(\d+)$/);
      if (match) {
        const code = match[1];
        const num = parseInt(match[2]);
        const current = articleCounters.get(code) || 0;
        if (num > current) articleCounters.set(code, num);
      }
    }
  }
  console.log(`  Loaded ${articleCounters.size} existing article sequences`);
}

function generateArticle(categorySlug: string): string {
  const code = SLUG_TO_CODE[categorySlug] || "GEN";
  const next = (articleCounters.get(code) || 0) + 1;
  articleCounters.set(code, next);
  return `MP-${code}-${String(next).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Call OpenRouter with cache_control on system prompt
// ---------------------------------------------------------------------------
async function callOpenRouter(
  systemPrompt: string,
  userMessage: string
): Promise<GeneratedCard[]> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://metallportal.vercel.app",
      "X-Title": "МеталлПортал Card Generator",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  // Log usage for cost tracking
  const usage = data.usage;
  if (usage) {
    const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
    console.log(
      `  tokens: prompt=${usage.prompt_tokens} (cached=${cached}) completion=${usage.completion_tokens}`
    );
  }

  let parsed: { items: GeneratedCard[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("\n  JSON parse error. Raw:\n", text.slice(0, 500));
    throw new Error("Failed to parse OpenRouter response as JSON");
  }

  return parsed.items;
}

// ---------------------------------------------------------------------------
// Format product data for the prompt
// ---------------------------------------------------------------------------
function formatProductForPrompt(p: ProductRow, index: number): string {
  const parts = [`${index}. ${p.name}`];
  if (p.gost) parts.push(`ГОСТ: ${p.gost}`);
  if (p.steel_grade) parts.push(`Марка: ${p.steel_grade}`);
  if (p.dimensions) parts.push(`Размер: ${p.dimensions}`);
  if (p.diameter) parts.push(`⌀${p.diameter} мм`);
  if (p.thickness) parts.push(`Толщина: ${p.thickness} мм`);
  if (p.length) parts.push(`Длина: ${p.length} м`);
  if (p.coating) parts.push(`Покрытие: ${p.coating}`);
  if (p.weight_per_meter) parts.push(`Вес: ${p.weight_per_meter} кг/м`);
  parts.push(`Ед.: ${p.unit}`);
  if (p.best_price) parts.push(`Цена: ${p.best_price} ₽/${p.unit}`);
  return parts.join(" | ");
}

// ---------------------------------------------------------------------------
// Save batch to Supabase
// ---------------------------------------------------------------------------
async function saveBatch(
  products: ProductRow[],
  cards: GeneratedCard[],
  dryRun: boolean
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const card = cards[i];
    if (!card) { failed++; continue; }

    const article = generateArticle(p.category_slug);

    if (dryRun) {
      console.log(`\n  [DRY] ${p.name}`);
      console.log(`    article:     ${article}`);
      console.log(`    seo_title:   ${card.seo_title} (${card.seo_title.length} chars)`);
      console.log(`    seo_desc:    ${card.seo_description.slice(0, 80)}...`);
      console.log(`    seo_text:    ${card.seo_text.slice(0, 100)}...`);
      saved++;
      continue;
    }

    const { error } = await supabase
      .from("products")
      .update({
        seo_title: card.seo_title,
        seo_description: card.seo_description,
        seo_text: card.seo_text,
        article,
      })
      .eq("id", p.id);

    if (error) {
      console.error(`\n  ✗ ${p.id} (${p.name}): ${error.message}`);
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

  const limit    = args.limit    ? parseInt(args.limit)    : undefined;
  const offset   = args.offset   ? parseInt(args.offset)   : 0;
  const dryRun   = args["dry-run"] === "true";
  const category = args.category ?? "";

  console.log("═══════════════════════════════════════════════════");
  console.log("  МеталлПортал — SEO Card Generator");
  console.log("═══════════════════════════════════════════════════\n");

  if (dryRun) console.log("🔍 DRY RUN — nothing will be written to DB\n");

  // 1. Load SEO rules
  console.log("Loading SEO rules from docs/SEO_RULES.md...");
  const seoRules = loadSeoRules();
  const systemPrompt = buildSystemPrompt(seoRules);
  console.log(`  System prompt: ${systemPrompt.length} chars (will be cached)\n`);

  // 2. Init article counters
  console.log("Loading existing article numbers...");
  await initArticleCounters();

  // 3. Fetch products
  console.log("\nFetching products...");
  let query = supabase
    .from("products")
    .select(`
      id, name, slug, gost, steel_grade, dimensions,
      diameter, thickness, length, unit, coating, weight_per_meter,
      category:categories(slug),
      price_items(base_price, discount_price)
    `)
    .is("seo_text", null)
    .eq("is_active", true)
    .order("created_at");

  if (category) {
    // Filter by category slug
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .single();
    if (cat) {
      query = query.eq("category_id", cat.id);
      console.log(`  Filtering by category: ${category}`);
    }
  }

  if (limit) {
    query = query.range(offset, offset + limit - 1);
  } else if (offset) {
    query = query.range(offset, offset + 99999);
  }

  const { data: rawProducts, error } = await query;
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!rawProducts?.length) {
    console.log("No products found (all already have seo_text?).");
    return;
  }

  // Map to typed rows
  const products: ProductRow[] = rawProducts.map((p: any) => {
    const prices = (p.price_items || [])
      .map((pi: any) => Number(pi.discount_price ?? pi.base_price))
      .filter((n: number) => n > 0);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      gost: p.gost,
      steel_grade: p.steel_grade,
      dimensions: p.dimensions,
      diameter: p.diameter,
      thickness: p.thickness,
      length: p.length,
      unit: p.unit || "т",
      coating: p.coating,
      weight_per_meter: p.weight_per_meter,
      category_slug: p.category?.slug ?? "",
      best_price: prices.length ? Math.min(...prices) : null,
    };
  });

  const total = products.length;
  const batchCount = Math.ceil(total / BATCH_SIZE);
  console.log(`\nFound ${total} products → ${batchCount} batches of ${BATCH_SIZE}\n`);

  // 4. Process batches
  let totalSaved = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = products.slice(i, i + BATCH_SIZE);

    console.log(`\n── Batch ${batchNum}/${batchCount} (${batch.length} items) ──`);

    const userMessage = `Сгенерируй SEO карточки для ${batch.length} товаров:\n\n` +
      batch.map((p, idx) => formatProductForPrompt(p, idx + 1)).join("\n");

    try {
      const cards = await callOpenRouter(systemPrompt, userMessage);

      if (cards.length !== batch.length) {
        console.warn(`  ⚠ Expected ${batch.length} items, got ${cards.length}`);
      }

      const { saved, failed } = await saveBatch(batch, cards, dryRun);
      totalSaved += saved;
      totalFailed += failed;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (totalSaved / parseFloat(elapsed) * 60).toFixed(0);
      console.log(`  ✓ saved=${saved} failed=${failed} | total=${totalSaved}/${total} | ${elapsed}s | ~${rate}/min`);
    } catch (err) {
      console.error(`  ✗ batch error: ${(err as Error).message}`);
      totalFailed += batch.length;
    }

    // Pause between batches (rate limit)
    if (i + BATCH_SIZE < total) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(55)}`);
  console.log(`Done in ${elapsed}s`);
  console.log(`  Saved:  ${totalSaved}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Total:  ${total}`);
  console.log(`${"═".repeat(55)}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

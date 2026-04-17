/**
 * Import products from sortovojprokat_processed.txt and truby_pricelist.txt
 * into Supabase. Groups by unique product name → creates 1 product + N price_items.
 *
 * Usage: npx tsx scripts/import_new_products.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// Load .env.local
try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()])
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPPLIER_ID = "a2000000-0000-0000-0000-000000000001";

// ── Transliterate Russian → slug ──
const TRANSLIT: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",
  к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
  х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
};
function toSlug(s: string): string {
  return s.toLowerCase()
    .replace(/[а-яёъь]/g, c => TRANSLIT[c] || "")
    .replace(/⌀/g, "d")
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

function makeArticle(name: string): string {
  return "MC-" + createHash("md5").update(name).digest("hex").slice(0, 8).toUpperCase();
}

// ── Category mapping ──
// sortovojprokat types → DB slug
const SORTOVOY_MAP: Record<string, string> = {
  "Арматура": "armatura",
  "Балка двутавровая": "dvutavr",
  "Швеллер": "shveller",
  "Уголок": "ugolok",
  "Полоса г/к": "polosa-g-k",
  "Круг г/к": "krug-stalnoy",
  "Катанка": "sortovoy-prokat",
  "Квадрат г/к": "kvadrat-goryachekatanyy",
};

// truby types → DB slug
const TRUBY_MAP: Record<string, string> = {
  "Трубы водогазопроводные чёрные": "truby-stalnye",
  "Трубы г/д бесшовные нефтепроводные": "truby-g-d",
  "Трубы х/д бесшовные": "truby-kh-d",
  "Трубы электросварные круглые": "elektrosvarnye-truby",
  "Трубы профильные прямоугольные": "truba-profilnaya",
  "Трубы профильные квадратные": "truba-profilnaya",
  "Трубы профильные овальные": "truba-profilnaya",
  "Трубы водогазопроводные оцинкованные": "truba-otsinkovannaya",
};

interface RawRow {
  name: string;
  description: string;
  gost: string;
  unit: string;
  price: number;
  diameter: number | null;
  thickness: number | null;
  length: string;
  steelGrade: string;
  categorySlug: string;
}

function parseSortovoy(filePath: string): RawRow[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split("\n").filter(l => l.trim());
  const rows: RawRow[] = [];

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 9) continue;
    const type = cols[0].trim();
    if (type === "Тип изделия") continue; // header

    const catSlug = SORTOVOY_MAP[type];
    if (!catSlug) { console.warn(`  Unknown sortovoy type: "${type}"`); continue; }

    let name: string, diameter: number | null, length: string, gost: string, unit: string, price: number, desc: string, steelGrade: string;

    if (cols.length >= 10) {
      // 10-col format: Type|Grade|Name|Diameter|Length|Section|GOST|Unit|Price|Desc
      name = cols[2].trim();
      diameter = parseFloat(cols[3]) || null;
      length = cols[4].trim();
      gost = cols[6].trim();
      unit = cols[7].trim();
      price = parseFloat(cols[8]) || 0;
      desc = cols[9]?.trim() || "";
      steelGrade = cols[1]?.trim() || "";
    } else {
      // 9-col format: Type|Number|Dash|Name|Length|GOST|Unit|Price|Desc
      name = cols[3].trim();
      diameter = null;
      length = cols[4].trim();
      gost = cols[5].trim();
      unit = cols[6].trim();
      price = parseFloat(cols[7]) || 0;
      desc = cols[8]?.trim() || "";
      steelGrade = cols[1]?.trim() || "";
    }

    rows.push({ name, description: desc, gost, unit, price, diameter, thickness: null, length, steelGrade, categorySlug: catSlug });
  }
  return rows;
}

function parseTruby(filePath: string): RawRow[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split("\n").filter(l => l.trim());
  const rows: RawRow[] = [];

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 11) continue;
    const category = cols[0].trim();
    if (category === "Категория") continue; // header

    const catSlug = TRUBY_MAP[category];
    if (!catSlug) { console.warn(`  Unknown truby category: "${category}"`); continue; }

    const name = cols[3].trim();
    const thickness = parseFloat(cols[5]) || null;
    const length = cols[6].trim();
    const gost = cols[7].trim();
    const unit = cols[8].trim();
    const price = parseFloat(cols[9]) || 0;
    const desc = cols[10]?.trim() || "";
    const steelGrade = cols[2]?.trim() || "";

    rows.push({ name, description: desc, gost, unit, price, diameter: null, thickness, length, steelGrade, categorySlug: catSlug });
  }
  return rows;
}

interface Product {
  name: string;
  slug: string;
  article: string;
  description: string;
  gost: string;
  unit: string;
  steelGrade: string;
  diameter: number | null;
  thickness: number | null;
  categorySlug: string;
  prices: number[];
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  МеталлПортал — Import New Products");
  console.log("═══════════════════════════════════════════════════\n");

  // Parse files
  const sortovoyPath = "/Users/sergey/Desktop/металл/мои наработки и информация/товары/sortovojprokat_processed.txt";
  const trubyPath = "/Users/sergey/Desktop/металл/мои наработки и информация/товары/truby_pricelist.txt";

  console.log("Parsing sortovojprokat_processed.txt...");
  const sortovoyRows = parseSortovoy(sortovoyPath);
  console.log(`  ${sortovoyRows.length} rows`);

  console.log("Parsing truby_pricelist.txt...");
  const trubyRows = parseTruby(trubyPath);
  console.log(`  ${trubyRows.length} rows`);

  const allRows = [...sortovoyRows, ...trubyRows];
  console.log(`\nTotal rows: ${allRows.length}`);

  // Group by product name → deduplicate
  const productMap = new Map<string, Product>();
  for (const row of allRows) {
    const existing = productMap.get(row.name);
    if (existing) {
      existing.prices.push(row.price);
    } else {
      productMap.set(row.name, {
        name: row.name,
        slug: toSlug(row.name),
        article: makeArticle(row.name),
        description: row.description,
        gost: row.gost,
        unit: row.unit,
        steelGrade: row.steelGrade,
        diameter: row.diameter,
        thickness: row.thickness,
        categorySlug: row.categorySlug,
        prices: [row.price],
      });
    }
  }
  console.log(`Unique products: ${productMap.size}`);
  console.log(`Total price items: ${allRows.length}`);

  // Load categories from DB
  console.log("\nLoading categories from DB...");
  const { data: cats, error: catError } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("is_active", true);

  if (catError) { console.error("Category load error:", catError); process.exit(1); }
  const slugToId = new Map((cats ?? []).map((c: any) => [c.slug, c.id]));

  // Verify all category slugs exist
  const usedSlugs = new Set([...productMap.values()].map(p => p.categorySlug));
  for (const slug of usedSlugs) {
    if (!slugToId.has(slug)) {
      console.error(`  MISSING category slug: "${slug}"`);
      process.exit(1);
    }
  }
  console.log(`  All ${usedSlugs.size} category slugs found in DB`);

  // Ensure no slug collisions (add suffix if needed)
  const slugSet = new Set<string>();
  for (const p of productMap.values()) {
    let s = p.slug;
    let i = 2;
    while (slugSet.has(s)) { s = p.slug + "-" + i++; }
    p.slug = s;
    slugSet.add(s);
  }

  // Insert products in batches of 50
  const products = [...productMap.values()];
  let insertedProducts = 0;
  let insertedPrices = 0;

  console.log(`\nInserting ${products.length} products + price_items...\n`);

  for (let i = 0; i < products.length; i += 50) {
    const batch = products.slice(i, i + 50);

    const productRows = batch.map(p => ({
      name: p.name,
      slug: p.slug,
      article: p.article,
      description: p.description,
      category_id: slugToId.get(p.categorySlug)!,
      supplier_id: SUPPLIER_ID,
      gost: p.gost || null,
      steel_grade: p.steelGrade || null,
      diameter: p.diameter,
      thickness: p.thickness,
      unit: p.unit.replace("теор.", "").trim() || "т",
      is_active: true,
    }));

    const { data: inserted, error: pErr } = await supabase
      .from("products")
      .insert(productRows)
      .select("id, slug");

    if (pErr) {
      console.error(`  Error inserting products batch ${i}: ${pErr.message}`);
      // Try one by one on conflict
      for (const row of productRows) {
        const { error: singleErr } = await supabase.from("products").insert(row);
        if (singleErr) console.error(`    Skip "${row.name}": ${singleErr.message}`);
        else insertedProducts++;
      }
      continue;
    }

    insertedProducts += (inserted ?? []).length;

    // Create price_items for each inserted product
    const slugToDbId = new Map((inserted ?? []).map((r: any) => [r.slug, r.id]));

    const priceRows: any[] = [];
    for (const p of batch) {
      const dbId = slugToDbId.get(p.slug);
      if (!dbId) continue;
      for (const price of p.prices) {
        priceRows.push({
          product_id: dbId,
          supplier_id: SUPPLIER_ID,
          base_price: price,
          min_quantity: 1,
          currency: "RUB",
          in_stock: true,
        });
      }
    }

    if (priceRows.length > 0) {
      const { error: piErr } = await supabase.from("price_items").insert(priceRows);
      if (piErr) console.error(`  Price items error batch ${i}: ${piErr.message}`);
      else insertedPrices += priceRows.length;
    }

    process.stdout.write(`  batch ${Math.floor(i/50) + 1}/${Math.ceil(products.length/50)}: +${(inserted??[]).length} products, +${priceRows.length} prices\n`);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  DONE");
  console.log(`  Products inserted: ${insertedProducts}`);
  console.log(`  Price items inserted: ${insertedPrices}`);
  console.log("═══════════════════════════════════════════════════");

  // Verify
  const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
  console.log(`\nTotal products in DB: ${count}`);
}

main().catch(console.error);

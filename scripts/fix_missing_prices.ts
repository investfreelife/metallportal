import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

try {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SID = "a2000000-0000-0000-0000-000000000001";

async function main() {
  // Load catalog
  const items = JSON.parse(readFileSync(join(process.cwd(), "data/catalog_full.json"), "utf-8"));
  const priceBySlug = new Map(items.map((i: any) => [i.article.toLowerCase(), i.price as number]));

  // Find products without price_items: get all product IDs, then all price_item product_ids
  console.log("Finding products without prices...");

  // Get first 200 slugs from catalog (batch 1 was the one that failed)
  const first200slugs = items.slice(0, 200).map((i: any) => i.article.toLowerCase());

  const { data: prods } = await sb.from("products").select("id, slug").in("slug", first200slugs);
  if (!prods?.length) { console.log("No products found"); return; }

  const prodIds = prods.map((p) => p.id);
  const { data: existingPrices } = await sb.from("price_items").select("product_id").in("product_id", prodIds);
  const hasPrice = new Set((existingPrices || []).map((e) => e.product_id));

  const missing = prods.filter((p) => !hasPrice.has(p.id));
  console.log(`Products missing prices: ${missing.length}`);

  if (missing.length === 0) {
    console.log("All good! No missing prices.");
    return;
  }

  const rows = missing.map((p) => ({
    id: randomUUID(),
    product_id: p.id,
    supplier_id: SID,
    base_price: priceBySlug.get(p.slug) ?? 0,
    discount_price: Math.round((priceBySlug.get(p.slug) ?? 0) * 1.08 * 100) / 100,
    in_stock: true,
    stock_quantity: 1000,
  }));

  // Insert in one batch
  const { error } = await sb.from("price_items").insert(rows);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log(`Inserted ${rows.length} price items`);
  }

  // Verify
  const { count } = await sb.from("price_items").select("*", { count: "exact", head: true });
  console.log(`Total price items now: ${count}`);
}

main().catch(console.error);

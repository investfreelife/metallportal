/**
 * Delete ALL products from Supabase.
 * Also deletes related price_items (CASCADE) and favorites.
 *
 * Usage: npx tsx scripts/clear_products.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

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

async function main() {
  // Count before
  const { count: before } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  console.log(`Products before: ${before}`);

  // Delete in batches of 1000
  let totalDeleted = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("products")
      .select("id")
      .limit(200);

    if (!batch || batch.length === 0) break;

    const ids = batch.map((r: any) => r.id);
    const { error } = await supabase
      .from("products")
      .delete()
      .in("id", ids);

    if (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }

    totalDeleted += ids.length;
    console.log(`  deleted batch: ${ids.length} (total: ${totalDeleted})`);
  }

  // Count after
  const { count: after } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  console.log(`Deleted: ${(before ?? 0) - (after ?? 0)}`);
  console.log(`Products after: ${after}`);
}

main();

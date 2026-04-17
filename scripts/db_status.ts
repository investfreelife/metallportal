import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

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

async function main() {
  const { count: pc } = await sb.from("products").select("*", { count: "exact", head: true });
  const { count: pic } = await sb.from("price_items").select("*", { count: "exact", head: true });
  console.log(`Products: ${pc}`);
  console.log(`Price items: ${pic}`);
  console.log(`Missing prices: ${(pc ?? 0) - (pic ?? 0)}`);
}

main().catch(console.error);

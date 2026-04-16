/**
 * Generates 5 hero images via OpenRouter DALL-E 3.
 * Uploads to Supabase Storage bucket "hero-images".
 * Updates categories.image_url.
 */
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
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* external */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Note: OpenRouter does not support image generation (404).
// Using Unsplash free stock images instead.
const IMAGES = [
  { slug: "metalloprokat",  query: "steel+pipes+warehouse+industrial" },
  { slug: "konstruktsii",   query: "steel+frame+building+construction" },
  { slug: "zabory",         query: "metal+fence+gate+steel" },
  { slug: "zdaniya",        query: "prefab+warehouse+metal+building" },
  { slug: "zakaz",          query: "welding+metalwork+fabrication+sparks" },
];

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "hero-images")) {
    const { error } = await supabase.storage.createBucket("hero-images", { public: true });
    if (error) throw error;
    console.log("  Created bucket 'hero-images'");
  }
}

async function fetchStockImage(query: string): Promise<Buffer> {
  // loremflickr.com — free keyword-based stock photos
  const keywords = query.replace(/\+/g, ",");
  const url = `https://loremflickr.com/1792/1024/${keywords}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`loremflickr ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("Ensuring storage bucket...");
  await ensureBucket();

  let ok = 0, fail = 0;
  for (const img of IMAGES) {
    process.stdout.write(`  ${img.slug}... `);
    try {
      const buf = await fetchStockImage((img as any).query);
      const path = `${img.slug}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("hero-images")
        .upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("hero-images").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("categories")
        .update({ image_url: data.publicUrl })
        .eq("slug", img.slug);
      if (dbErr) throw dbErr;

      console.log(`✓`);
      ok++;
    } catch (e: any) {
      console.log(`✗ ${e.message.slice(0, 100)}`);
      fail++;
    }
    if (ok + fail < IMAGES.length) await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\nDone. OK: ${ok}  Failed: ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

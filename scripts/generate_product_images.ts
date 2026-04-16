/**
 * Generates one representative image per product type and assigns it to all
 * products of that type in Supabase.
 *
 * Uses loremflickr.com for industry-specific stock photos (free, no API key).
 * If FAL_API_KEY is set in .env.local, uses fal.ai fal-ai/flux/schnell instead.
 *
 * Usage:
 *   npx tsx scripts/generate_product_images.ts
 *   npx tsx scripts/generate_product_images.ts --dry-run
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
} catch { /* env set externally */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProductType {
  categorySlug: string;
  namePattern: string;         // used in LIKE match
  loremflickrQuery: string;    // keywords for loremflickr
  falPrompt: string;           // prompt for fal.ai if key is available
  seed: number;                // unique seed for consistent loremflickr result
}

const PRODUCT_TYPES: ProductType[] = [
  {
    categorySlug: "truba-vgp",
    namePattern: "%Труба ВГП%",
    loremflickrQuery: "pipe,steel,galvanized,plumbing,tube",
    falPrompt: "professional product photo, steel VGP water-gas pipe, galvanized surface, industrial warehouse background, high quality",
    seed: 1001,
  },
  {
    categorySlug: "truba-profilnaya",
    namePattern: "%Труба профильн%",
    loremflickrQuery: "square,tube,steel,profile,rectangular",
    falPrompt: "professional product photo, square steel profile tube 40x40, metallic surface, warehouse background",
    seed: 1002,
  },
  {
    categorySlug: "truba-svarnaya",
    namePattern: "%Труба электросварн%",
    loremflickrQuery: "pipe,welded,steel,round,industrial",
    falPrompt: "professional product photo, round welded steel pipe, metallic surface, industrial setting",
    seed: 1003,
  },
  {
    categorySlug: "truba-besshovnaya",
    namePattern: "%Труба бесшовн%",
    loremflickrQuery: "seamless,pipe,steel,industrial,heavy",
    falPrompt: "professional product photo, seamless steel pipes stacked, thick wall, industrial warehouse",
    seed: 1004,
  },
  {
    categorySlug: "armatura-stalnaya",
    namePattern: "%Арматура%",
    loremflickrQuery: "rebar,steel,construction,reinforcement,bar",
    falPrompt: "professional product photo, steel rebar A500S construction reinforcement bars bundle, warehouse",
    seed: 1005,
  },
  {
    categorySlug: "setka-svarnaya",
    namePattern: "%Сетка сварн%",
    loremflickrQuery: "wire,mesh,welded,steel,fence",
    falPrompt: "professional product photo, welded wire mesh panels, galvanized steel, warehouse background",
    seed: 1006,
  },
  {
    categorySlug: "setka-kladochnaya",
    namePattern: "%Сетка кладочн%",
    loremflickrQuery: "masonry,wire,mesh,construction,steel",
    falPrompt: "professional product photo, masonry wire mesh roll, steel construction material",
    seed: 1007,
  },
  {
    categorySlug: "balka-dvutavr",
    namePattern: "%Двутавр%",
    loremflickrQuery: "I-beam,steel,girder,structural,construction",
    falPrompt: "professional product photo, steel I-beam H-beam structural girder, industrial warehouse",
    seed: 1008,
  },
  {
    categorySlug: "shveller",
    namePattern: "%Швеллер%",
    loremflickrQuery: "channel,steel,beam,U-beam,structural",
    falPrompt: "professional product photo, steel channel beam U-profile, structural steel, warehouse",
    seed: 1009,
  },
  {
    categorySlug: "list-goryachekatany",
    namePattern: "%горячекатан%",
    loremflickrQuery: "steel,sheet,hot,rolled,plate",
    falPrompt: "professional product photo, hot-rolled steel sheet plate stack, metallic surface, warehouse",
    seed: 1010,
  },
  {
    categorySlug: "list-holodnokatany",
    namePattern: "%холоднокатан%",
    loremflickrQuery: "steel,sheet,cold,rolled,smooth",
    falPrompt: "professional product photo, cold-rolled steel sheet, smooth surface, metallic, warehouse",
    seed: 1011,
  },
  {
    categorySlug: "list-otsinkovanny",
    namePattern: "%оцинков%",
    loremflickrQuery: "galvanized,steel,sheet,zinc,coated",
    falPrompt: "professional product photo, galvanized zinc-coated steel sheet, shiny surface, warehouse",
    seed: 1012,
  },
  {
    categorySlug: "list-riflyony",
    namePattern: "%рифлён%",
    loremflickrQuery: "diamond,plate,steel,checkered,tread",
    falPrompt: "professional product photo, diamond plate steel checkered tread plate, industrial",
    seed: 1013,
  },
  {
    categorySlug: "ugolok-ravnopolochny",
    namePattern: "%Уголок равнополочн%",
    loremflickrQuery: "steel,angle,equal,L-profile,metal",
    falPrompt: "professional product photo, equal steel angle bar L-profile, metallic, warehouse background",
    seed: 1014,
  },
  {
    categorySlug: "polosa-stalnaya",
    namePattern: "%Полоса%",
    loremflickrQuery: "steel,flat,bar,strip,metal",
    falPrompt: "professional product photo, steel flat bar strip, metallic surface, industrial warehouse",
    seed: 1015,
  },
];

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === "product-images");
  if (!exists) {
    const { error } = await supabase.storage.createBucket("product-images", { public: true });
    if (error) throw error;
    console.log("  Created bucket: product-images");
  }
  // Ensure public
  await supabase.storage.updateBucket("product-images", { public: true });
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateWithLoremflickr(pt: ProductType): Promise<Buffer> {
  const url = `https://loremflickr.com/800/600/${pt.loremflickrQuery}?random=${pt.seed}`;
  console.log(`    loremflickr: ${url}`);
  return downloadImage(url);
}

async function generateWithFal(pt: ProductType): Promise<Buffer> {
  const FAL_KEY = process.env.FAL_API_KEY!;
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: pt.falPrompt,
      image_size: "landscape_4_3",
      num_inference_steps: 4,
      num_images: 1,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { images: Array<{ url: string }> };
  const imgUrl = data.images?.[0]?.url;
  if (!imgUrl) throw new Error("fal.ai returned no images");
  console.log(`    fal.ai image: ${imgUrl}`);
  return downloadImage(imgUrl);
}

async function processProductType(pt: ProductType, dryRun: boolean): Promise<boolean> {
  console.log(`\n  [${pt.categorySlug}]`);

  if (dryRun) {
    console.log(`    DRY RUN — would generate image and update products matching: ${pt.namePattern}`);
    return true;
  }

  try {
    const useFal = !!process.env.FAL_API_KEY;
    const imageBuffer = useFal
      ? await generateWithFal(pt)
      : await generateWithLoremflickr(pt);

    const filename = `${pt.categorySlug}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filename, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;

    // Get category id
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", pt.categorySlug)
      .single();

    if (!category) {
      console.log(`    WARNING: category not found for slug ${pt.categorySlug}`);
      return false;
    }

    const { error: updateError, count } = await supabase
      .from("products")
      .update({ image_url: publicUrl })
      .eq("category_id", category.id)
      .is("image_url", null);

    if (updateError) throw updateError;
    console.log(`    ✓ Updated ${count ?? "?"} products → ${publicUrl.slice(0, 70)}...`);
    return true;
  } catch (err: any) {
    console.error(`    ✗ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) console.log("DRY RUN — nothing will be written\n");

  const useFal = !!process.env.FAL_API_KEY;
  console.log(`Image source: ${useFal ? "fal.ai (flux/schnell)" : "loremflickr.com"}`);
  console.log(`Product types: ${PRODUCT_TYPES.length}\n`);

  if (!dryRun) {
    console.log("Ensuring product-images bucket exists...");
    await ensureBucket();
  }

  let ok = 0;
  let fail = 0;
  for (const pt of PRODUCT_TYPES) {
    const success = await processProductType(pt, dryRun);
    if (success) ok++; else fail++;
    if (!dryRun) await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Done. OK: ${ok}  Failed: ${fail}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

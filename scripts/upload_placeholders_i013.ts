/**
 * i013 placeholder upload — 2 industrial JPEGs into product-images/_placeholders/.
 *
 * Source: Sergey's ChatGPT-generated industrial photos compressed to 1200px JPEG 60q.
 * Size: ~108-117 KB each (under 200 KB ТЗ limit).
 *
 * Usage:
 *   npx tsx scripts/upload_placeholders_i013.ts
 *
 * Already executed 2026-05-06 12:35 — uploaded successfully.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "fs";
import { resolve } from "path";

loadEnvConfig(resolve(__dirname, ".."));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const sb = createClient(url, sr, { auth: { persistSession: false } });
  const files = [
    { local: "/tmp/industrial-warehouse-1.jpg", remote: "_placeholders/industrial-warehouse-1.jpg" },
    { local: "/tmp/industrial-frame-2.jpg",     remote: "_placeholders/industrial-frame-2.jpg" },
  ];
  for (const f of files) {
    const buf = readFileSync(f.local);
    const { data, error } = await sb.storage.from("product-images")
      .upload(f.remote, buf, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error(`❌ ${f.remote}: ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ ${f.remote} → ${buf.length} bytes`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

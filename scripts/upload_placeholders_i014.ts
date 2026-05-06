/**
 * i014 placeholder upload — armatura + shveller form-factor photos.
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
    { local: "/tmp/armatura-placeholder.jpg", remote: "_placeholders/armatura-rebar.jpg" },
    { local: "/tmp/shveller-placeholder.jpg", remote: "_placeholders/shveller-channel.jpg" },
  ];
  for (const f of files) {
    const buf = readFileSync(f.local);
    const { error } = await sb.storage.from("product-images")
      .upload(f.remote, buf, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error(`❌ ${f.remote}: ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ ${f.remote} → ${buf.length} bytes`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

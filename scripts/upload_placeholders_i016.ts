/**
 * i016 placeholder upload — 15 Wikimedia Commons photos.
 * All licensed for commercial use (CC-BY-SA / CC-BY / CC0 / Public domain).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

loadEnvConfig(resolve(__dirname, ".."));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const sb = createClient(url, sr, { auth: { persistSession: false } });
  const dir = "/tmp/i016_compressed";
  const files = readdirSync(dir).filter((f) => f.endsWith(".jpg"));

  for (const fn of files) {
    const buf = readFileSync(`${dir}/${fn}`);
    const remote = `_placeholders/${fn}`;
    const { error } = await sb.storage.from("product-images")
      .upload(remote, buf, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error(`❌ ${remote}: ${error.message}`);
      continue;
    }
    console.log(`✅ ${remote} → ${(buf.length / 1024).toFixed(0)} KB`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
for (const l of env.split("\n")) {
  const eq = l.indexOf("=");
  if (eq === -1) continue;
  const k = l.slice(0, eq).trim();
  const v = l.slice(eq + 1).trim();
  if (k && !process.env[k]) process.env[k] = v;
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await sb.storage.createBucket("site-images", { public: true });
  if (error && !error.message.includes("already exists")) {
    console.error("Error:", error.message);
  } else {
    console.log("Bucket 'site-images' ready:", data ?? "already exists");
  }
}

main();

/**
 * One-shot скрипт: деактивация категории `shveller` (общий, sort_order=3).
 *
 * Зачем: в раздаче прайса от поставщика раздел «Швеллер» (общий) полностью
 * перекрывается тремя более структурированными разделами — «Швеллер
 * горячекатаный» (П/У), «Швеллер гнутый», «Швеллер низколегированный».
 * Чтобы не дублировать SKU и не путать пользователя, оставляем эти три как
 * отдельные L3-категории, а общий `shveller` гасим (is_active=false) — он
 * перестаёт показываться в Header / в выдаче, но запись в БД сохраняется
 * (parent_id, sort_order — на случай rollback'а).
 *
 * Согласовано: решение 1 из чата к W2-6 (Балки + Швеллер импорт).
 *
 * Идемпотентен: повторный run просто перезапишет is_active=false (no-op
 * в смысле user-visible state).
 *
 * Usage:
 *   npx tsx scripts/deactivate_shveller_obshchiy.ts             # dry-run
 *   npx tsx scripts/deactivate_shveller_obshchiy.ts --commit    # запись
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(__dirname, ".."));

const SLUG = "shveller";

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";

  console.log(`\n=== deactivate_shveller_obshchiy.ts — ${mode} ===\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  const { data: existing, error: selErr } = await supabase
    .from("categories")
    .select("id, slug, name, is_active, sort_order")
    .eq("slug", SLUG)
    .maybeSingle();
  if (selErr) {
    console.error("select error:", selErr.message);
    process.exit(1);
  }
  if (!existing) {
    console.log(`Category '${SLUG}' not found — nothing to do.`);
    return;
  }

  console.log(`Current: id=${existing.id}, is_active=${existing.is_active}`);

  if (existing.is_active === false) {
    console.log("Already deactivated — no-op.");
    return;
  }

  if (!isCommit) {
    console.log("\nDry-run: would set is_active=false. Re-run with --commit.\n");
    return;
  }

  const { error: updErr } = await supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", existing.id);
  if (updErr) {
    console.error("update error:", updErr.message);
    process.exit(1);
  }
  console.log(`\n  ✅ deactivated '${SLUG}' (id=${existing.id})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

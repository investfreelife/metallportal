/**
 * Seed для info-only категории `armatura-a500sneu-a1000` (W2-3).
 *
 * Категория уже существует в БД с W1 (id b88ba169-..., child of armatura-katanka),
 * но info-поля (description, seo_text, gost_url, cta_label, cta_action) не
 * были заполнены. Этот скрипт делает UPDATE existing record по slug.
 *
 * Идемпотентность: повторный --commit просто обновит те же значения, никаких
 * дублей. Если категория ещё не создана — fallback на INSERT с теми же полями
 * (корректный setup для clean-DB сценария).
 *
 * Usage:
 *   npx tsx scripts/seed_armatura_a500sneu.ts             # dry-run (default)
 *   npx tsx scripts/seed_armatura_a500sneu.ts --commit    # реальная запись
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(__dirname, ".."));

const SLUG = "armatura-a500sneu-a1000";
const PARENT_SLUG = "armatura-katanka"; // for INSERT fallback only

const PAYLOAD = {
  name: "Арматура А500СНЕУ А1000",
  description:
    "Принимаем заказы на сертифицированную арматуру по ГОСТ 34028-2016 классов А500СНЕУ и А1000, А1000Р с дополнительным набором технических требований.",
  seo_text: `## Дополнительные технические требования

— **С** — свариваемый всеми способами сварки
— **Н** — повышенной категорией пластичности
— **Е** — высокой категорией пластичности (для сейсмически стойкого проката)
— **У** — с требованиями к выносливости при многократно повторяющихся циклических нагрузках
— **Р** — с требованиями по релаксации напряжений

[Скачать ГОСТ 34028-2016 (PDF)](https://mc.ru/gost/gost_34028_2016.pdf)

Применяется в проектах:

- Мостостроение
- Сейсмостойкие конструкции (зоны 8-9 баллов)
- Преднапряжённый железобетон
- Особо ответственные ЖБИ

Цены формируются под заказ — каждая партия проходит индивидуальную сертификацию.`,
  gost_url: "https://mc.ru/gost/gost_34028_2016.pdf",
  cta_label: "Получить цену",
  cta_action: "phone",
};

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT (will write to DB)" : "DRY-RUN (no writes)";

  console.log(`\n=== seed_armatura_a500sneu.ts — ${mode} ===\n`);
  console.log(`Slug: ${SLUG}`);
  console.log(`Name: ${PAYLOAD.name}`);
  console.log(`Description (${PAYLOAD.description.length} chars):`);
  console.log("  " + PAYLOAD.description);
  console.log(`\nseo_text (${PAYLOAD.seo_text.length} chars), markdown preview:`);
  console.log(
    PAYLOAD.seo_text.split("\n").map((l) => "  " + l).join("\n"),
  );
  console.log(`\nGOST URL:  ${PAYLOAD.gost_url}`);
  console.log(`CTA label: ${PAYLOAD.cta_label}`);
  console.log(`CTA action: ${PAYLOAD.cta_action}`);

  if (!isCommit) {
    console.log("\nDry-run complete. Re-run with --commit to update DB.\n");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  // 1. Существует ли категория?
  const { data: existing, error: selErr } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (selErr) {
    console.error("select error:", selErr.message);
    process.exit(1);
  }

  if (existing) {
    // UPDATE — категория из W1 уже есть.
    const { error: updErr } = await supabase
      .from("categories")
      .update(PAYLOAD)
      .eq("id", existing.id);
    if (updErr) {
      console.error("update error:", updErr.message);
      process.exit(1);
    }
    console.log(`\n  ✅ updated existing category (id=${existing.id})`);
    return;
  }

  // INSERT fallback — clean-DB сценарий, на всякий случай.
  const { data: parent, error: parErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", PARENT_SLUG)
    .single();
  if (parErr || !parent) {
    console.error(
      `parent category '${PARENT_SLUG}' not found — bootstrap data missing`,
    );
    process.exit(1);
  }

  const { error: insErr } = await supabase.from("categories").insert({
    ...PAYLOAD,
    slug: SLUG,
    parent_id: parent.id,
    is_active: true,
    sort_order: 3,
  });
  if (insErr) {
    console.error("insert error:", insErr.message);
    process.exit(1);
  }
  console.log("\n  ✅ inserted new category");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

/**
 * Raw-import reconciliation helper.
 *
 * Применяется в каждом seed-script перед actual INSERT для
 * соблюдения POLICY_raw-imports.md от Сергея.
 *
 * Bucket sort:
 *   - new                — slug не в БД → готовы к INSERT
 *   - identicalDupes     — slug exists + metadata match + price match → no-op
 *   - priceChanges       — slug exists + metadata match + price differs → REPORT, NO update
 *   - metadataConflicts  — slug exists + metadata differs → escalate, STOP this SKU
 *
 * Запреты per POLICY:
 *   - НЕ обновлять existing data автоматически
 *   - НЕ менять slug / dimensions / pack_options существующих
 *   - Любое из этих требует явный approve через новый ТЗ
 *
 * 6 open questions REPORT #003 — все resolved option A в ТЗ #005:
 *   1. slug-only для duplicate detection (deterministic от identity-key)
 *   2. slug глобально-уникальный (multi-supplier через price_items)
 *   3. Per-category nameNormalize hook
 *   4. priceEpsilonRub = 0.01 ₽
 *   5. Markdown-only escalation format
 *   6. data-only updates → scripts/updates/{date}_{description}.ts (отдельно)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ParsedSku = {
  slug: string;
  name: string;
  category_slug?: string;
  category_id?: string;
  diameter?: number | null;
  thickness?: number | null;
  length?: number | null;
  steel_grade?: string | null;
  dimensions?: Record<string, unknown> | null;
  prices: Array<{ unit: string; base_price: number }>;
};

export type PriceChange = {
  slug: string;
  unit: string;
  old: number;
  new: number;
  diff_pct: number;
};

export type MetadataConflict = {
  slug: string;
  parsed: ParsedSku;
  existing: Record<string, unknown>;
  diff_fields: string[];
};

export type ReconcileOptions = {
  supplierId: string;
  /** Per-category hook для нормализации name перед сравнением. */
  nameNormalize?: (raw: string) => string;
  /** Tolerance для price comparison. Default 0.01 ₽. */
  priceEpsilonRub?: number;
};

export type ReconcileResult = {
  new: ParsedSku[];
  identicalDupes: ParsedSku[];
  priceChanges: PriceChange[];
  metadataConflicts: MetadataConflict[];
};

type ExistingProduct = {
  id: string;
  slug: string;
  name: string;
  diameter: number | null;
  thickness: number | null;
  length: number | null;
  steel_grade: string | null;
  dimensions: Record<string, unknown> | null;
};

type ExistingPriceItem = {
  product_id: string;
  unit: string;
  base_price: number;
};

export async function reconcile(
  parsedSkus: ParsedSku[],
  supabase: SupabaseClient,
  options: ReconcileOptions,
): Promise<ReconcileResult> {
  const nameNormalize = options.nameNormalize ?? ((s: string) => s.trim());
  const epsilon = options.priceEpsilonRub ?? 0.01;

  const result: ReconcileResult = {
    new: [],
    identicalDupes: [],
    priceChanges: [],
    metadataConflicts: [],
  };

  if (parsedSkus.length === 0) return result;

  // 1. Bulk SELECT existing products by slug (one query, NOT N+1).
  const slugs = parsedSkus.map((s) => s.slug);
  const { data: existingProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, slug, name, diameter, thickness, length, steel_grade, dimensions")
    .in("slug", slugs);
  if (prodErr) throw new Error(`reconcile products SELECT: ${prodErr.message}`);

  const existingMap = new Map<string, ExistingProduct>(
    (existingProducts ?? []).map((p) => [p.slug, p as ExistingProduct]),
  );

  // 2. Bulk SELECT existing price_items для existing product_ids + supplier.
  const existingIds = (existingProducts ?? []).map((p) => p.id);
  let pricesByProductId = new Map<string, ExistingPriceItem[]>();
  if (existingIds.length > 0) {
    const { data: existingPrices, error: priceErr } = await supabase
      .from("price_items")
      .select("product_id, unit, base_price")
      .in("product_id", existingIds)
      .eq("supplier_id", options.supplierId);
    if (priceErr) throw new Error(`reconcile price_items SELECT: ${priceErr.message}`);

    for (const p of (existingPrices ?? []) as ExistingPriceItem[]) {
      if (!pricesByProductId.has(p.product_id)) pricesByProductId.set(p.product_id, []);
      pricesByProductId.get(p.product_id)!.push(p);
    }
  }

  // 3. Bucket sort.
  for (const parsed of parsedSkus) {
    const existing = existingMap.get(parsed.slug);

    if (!existing) {
      result.new.push(parsed);
      continue;
    }

    // Compare metadata (deep equal на нормализованных values).
    const metadataMatch = compareMetadata(parsed, existing, nameNormalize);

    if (!metadataMatch.equal) {
      result.metadataConflicts.push({
        slug: parsed.slug,
        parsed,
        existing,
        diff_fields: metadataMatch.diffFields,
      });
      continue;
    }

    // Metadata identical → check prices.
    const existingPriceList = pricesByProductId.get(existing.id) ?? [];
    const priceDiffs = comparePrices(parsed.prices, existingPriceList, epsilon);

    if (priceDiffs.length === 0) {
      result.identicalDupes.push(parsed);
    } else {
      for (const d of priceDiffs) {
        result.priceChanges.push({ slug: parsed.slug, ...d });
      }
    }
  }

  return result;
}

function compareMetadata(
  parsed: ParsedSku,
  existing: ExistingProduct,
  nameNormalize: (s: string) => string,
): { equal: boolean; diffFields: string[] } {
  const diffFields: string[] = [];

  if (nameNormalize(parsed.name) !== nameNormalize(existing.name)) {
    diffFields.push("name");
  }
  if (!nullSafeEqual(parsed.diameter, existing.diameter)) diffFields.push("diameter");
  if (!nullSafeEqual(parsed.thickness, existing.thickness)) diffFields.push("thickness");
  if (!nullSafeEqual(parsed.length, existing.length)) diffFields.push("length");
  if (
    (parsed.steel_grade ?? "") !==
    (existing.steel_grade ?? "")
  ) {
    diffFields.push("steel_grade");
  }
  // Existing.dimensions может прийти из REST как JSON-string (зависит от
  // Supabase client serialization). Нормализуем на parsed object перед сравнением.
  const parsedDims = parsed.dimensions ?? null;
  let existingDims: unknown = existing.dimensions ?? null;
  if (typeof existingDims === "string") {
    try {
      existingDims = JSON.parse(existingDims);
    } catch {
      // оставляем как есть — non-JSON string не сравнится с object
    }
  }
  if (!deepEqualJson(parsedDims, existingDims)) {
    diffFields.push("dimensions");
  }

  return { equal: diffFields.length === 0, diffFields };
}

function comparePrices(
  parsed: Array<{ unit: string; base_price: number }>,
  existing: ExistingPriceItem[],
  epsilon: number,
): Array<{ unit: string; old: number; new: number; diff_pct: number }> {
  const diffs: Array<{ unit: string; old: number; new: number; diff_pct: number }> = [];

  for (const p of parsed) {
    const e = existing.find((ep) => ep.unit === p.unit);
    if (!e) {
      diffs.push({ unit: p.unit, old: 0, new: p.base_price, diff_pct: 100 });
      continue;
    }
    if (Math.abs(p.base_price - e.base_price) > epsilon) {
      const diffPct = e.base_price !== 0 ? ((p.base_price - e.base_price) / e.base_price) * 100 : 100;
      diffs.push({
        unit: p.unit,
        old: e.base_price,
        new: p.base_price,
        diff_pct: Math.round(diffPct * 100) / 100,
      });
    }
  }

  return diffs;
}

function nullSafeEqual<T>(a: T | null | undefined, b: T | null | undefined): boolean {
  const av = a ?? null;
  const bv = b ?? null;
  if (av === null && bv === null) return true;
  return av === bv;
}

export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualJson(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keysA = Object.keys(ao).sort();
  const keysB = Object.keys(bo).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (!deepEqualJson(ao[keysA[i]], bo[keysB[i]])) return false;
  }
  return true;
}

/**
 * Format reconcile result в markdown — для embed в REPORT файл per POLICY.
 */
export function formatReconcileMarkdown(result: ReconcileResult): string {
  const lines: string[] = [];
  lines.push(`## Reconcile result\n`);
  lines.push(`- new (готовы к seed): **${result.new.length}**`);
  lines.push(`- identicalDupes (no-op): **${result.identicalDupes.length}**`);
  lines.push(`- priceChanges (REPORT only, NO update): **${result.priceChanges.length}**`);
  lines.push(`- metadataConflicts (escalation, STOP per SKU): **${result.metadataConflicts.length}**\n`);

  if (result.priceChanges.length > 0) {
    lines.push(`### Price changes detected (no action — для review)\n`);
    lines.push(`| slug | unit | old | new | diff% |`);
    lines.push(`|------|:--:|---:|---:|---:|`);
    for (const pc of result.priceChanges.slice(0, 20)) {
      lines.push(
        `| \`${pc.slug}\` | ${pc.unit} | ${pc.old} | ${pc.new} | ${pc.diff_pct.toFixed(2)}% |`,
      );
    }
    if (result.priceChanges.length > 20) {
      lines.push(`| ... | … | … | … | … |  *(+${result.priceChanges.length - 20} more)* |`);
    }
    lines.push("");
  }

  if (result.metadataConflicts.length > 0) {
    lines.push(`## ⚠ Escalation: metadata conflicts (slug collisions)\n`);
    for (const mc of result.metadataConflicts.slice(0, 10)) {
      lines.push(`### Issue: \`${mc.slug}\``);
      lines.push(`- diff_fields: \`${mc.diff_fields.join(", ")}\``);
      lines.push(`- Recommended action: A (rename incoming SKU) / B (update existing) / C (manual review)`);
      lines.push(`- Blocking: this SKU not seeded\n`);
    }
    if (result.metadataConflicts.length > 10) {
      lines.push(`*(+${result.metadataConflicts.length - 10} more conflicts — full list в JSON output)*\n`);
    }
  }

  return lines.join("\n");
}

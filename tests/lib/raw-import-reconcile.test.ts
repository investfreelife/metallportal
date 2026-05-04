/**
 * Tests для lib/raw-import-reconcile.ts
 *
 * Standalone runner (project не имеет unit test framework — Playwright только
 * для e2e). Запуск: `npx tsx tests/lib/raw-import-reconcile.test.ts`.
 * Exit 0 если все tests pass, 1 при failure.
 *
 * 4 cases per ТЗ #005:
 *   1. new           — slug не в БД
 *   2. identical_dup — slug + metadata + price match
 *   3. price_change  — slug + metadata match, price differs
 *   4. metadata_conflict — slug exists, metadata differs
 *
 * Использует mock SupabaseClient — не требует реальный коннект.
 */

import {
  reconcile,
  type ParsedSku,
  type ReconcileOptions,
  deepEqualJson,
} from "../../lib/raw-import-reconcile";

// ============================================================================
// Mock SupabaseClient
// ============================================================================

type MockExisting = {
  id: string;
  slug: string;
  name: string;
  diameter: number | null;
  thickness: number | null;
  length: number | null;
  steel_grade: string | null;
  dimensions: Record<string, unknown> | null;
};

type MockPrice = { product_id: string; unit: string; base_price: number; supplier_id: string };

function createMockSupabase(
  existingProducts: MockExisting[],
  existingPrices: MockPrice[],
) {
  return {
    from(table: string) {
      const data = table === "products" ? existingProducts : existingPrices;
      return {
        _filters: [] as Array<{ kind: string; col: string; values: unknown[] }>,
        select(_cols: string) {
          return this;
        },
        in(col: string, values: unknown[]) {
          this._filters.push({ kind: "in", col, values });
          return this;
        },
        eq(col: string, value: unknown) {
          this._filters.push({ kind: "eq", col, values: [value] });
          return this;
        },
        // Triggered when result awaited (or via .then())
        then(resolve: (r: { data: typeof data; error: null }) => void) {
          let filtered = data as Array<Record<string, unknown>>;
          for (const f of this._filters) {
            if (f.kind === "in") {
              filtered = filtered.filter((r) => f.values.includes(r[f.col]));
            } else if (f.kind === "eq") {
              filtered = filtered.filter((r) => r[f.col] === f.values[0]);
            }
          }
          resolve({ data: filtered as typeof data, error: null });
        },
      };
    },
  };
}

// ============================================================================
// Test runner
// ============================================================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
  }
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(`${name}: ${(err as Error).message}`);
    console.log(`  ✗ ${name} — ${(err as Error).message}`);
  }
}

// ============================================================================
// Cases
// ============================================================================

const SUPPLIER_ID = "d1000000-0000-0000-0000-000000000001";

const baseOptions: ReconcileOptions = {
  supplierId: SUPPLIER_ID,
  priceEpsilonRub: 0.01,
};

async function caseNew() {
  const supabase = createMockSupabase([], []);
  const parsed: ParsedSku[] = [
    {
      slug: "list-ocink-0p35x1250x2500-st02-zn100-nd",
      name: "Лист оцинкованный 0.35х1250х2500 Zn100 М пас",
      thickness: 0.35,
      steel_grade: "Ст02",
      dimensions: { thickness_mm: 0.35, width_mm: 1250, length_mm: 2500, coating: "Zn100" },
      prices: [{ unit: "шт", base_price: 948 }, { unit: "т", base_price: 109790 }],
    },
  ];

  const result = await reconcile(parsed, supabase as any, baseOptions);

  assert(result.new.length === 1, `new: expected 1, got ${result.new.length}`);
  assert(result.identicalDupes.length === 0, "identicalDupes: expected 0");
  assert(result.priceChanges.length === 0, "priceChanges: expected 0");
  assert(result.metadataConflicts.length === 0, "metadataConflicts: expected 0");
  assert(result.new[0].slug === parsed[0].slug, "new[0].slug match");
}

async function caseIdenticalDupe() {
  const slug = "anker-ab-8x45-nd";
  const supabase = createMockSupabase(
    [
      {
        id: "p1",
        slug,
        name: "Анкерный болт 8x45",
        diameter: 8,
        thickness: null,
        length: 45,
        steel_grade: null,
        dimensions: { anchor_type: "ankernyy-bolt" },
      },
    ],
    [{ product_id: "p1", unit: "шт", base_price: 2.485, supplier_id: SUPPLIER_ID }],
  );
  const parsed: ParsedSku[] = [
    {
      slug,
      name: "Анкерный болт 8x45",
      diameter: 8,
      length: 45,
      steel_grade: null,
      dimensions: { anchor_type: "ankernyy-bolt" },
      prices: [{ unit: "шт", base_price: 2.485 }],
    },
  ];

  const result = await reconcile(parsed, supabase as any, baseOptions);

  assert(result.new.length === 0, `new: expected 0, got ${result.new.length}`);
  assert(result.identicalDupes.length === 1, "identicalDupes: expected 1");
  assert(result.priceChanges.length === 0, "priceChanges: expected 0");
  assert(result.metadataConflicts.length === 0, "metadataConflicts: expected 0");
}

async function casePriceChange() {
  const slug = "krug-30-st3-nd";
  const supabase = createMockSupabase(
    [
      {
        id: "p2",
        slug,
        name: "Круг г/к конструкционный 30",
        diameter: 30,
        thickness: null,
        length: null,
        steel_grade: "Ст3",
        dimensions: null,
      },
    ],
    [{ product_id: "p2", unit: "т", base_price: 50000, supplier_id: SUPPLIER_ID }],
  );
  const parsed: ParsedSku[] = [
    {
      slug,
      name: "Круг г/к конструкционный 30",
      diameter: 30,
      steel_grade: "Ст3",
      dimensions: null,
      prices: [{ unit: "т", base_price: 52000 }], // +2000 ₽
    },
  ];

  const result = await reconcile(parsed, supabase as any, baseOptions);

  assert(result.new.length === 0, `new: expected 0, got ${result.new.length}`);
  assert(result.identicalDupes.length === 0, "identicalDupes: expected 0");
  assert(result.priceChanges.length === 1, `priceChanges: expected 1, got ${result.priceChanges.length}`);
  assert(result.metadataConflicts.length === 0, "metadataConflicts: expected 0");

  const pc = result.priceChanges[0];
  assert(pc.slug === slug, "priceChange slug");
  assert(pc.unit === "т", "priceChange unit");
  assert(pc.old === 50000, "priceChange old");
  assert(pc.new === 52000, "priceChange new");
  assert(Math.abs(pc.diff_pct - 4.0) < 0.01, `priceChange diff_pct: expected 4.0, got ${pc.diff_pct}`);
}

async function caseMetadataConflict() {
  const slug = "balka-25b1-st3-12000";
  const supabase = createMockSupabase(
    [
      {
        id: "p3",
        slug,
        name: "Балка 25Б1 12м",
        diameter: 25,
        thickness: null,
        length: 12000,
        steel_grade: "Ст3",
        dimensions: null,
      },
    ],
    [{ product_id: "p3", unit: "т", base_price: 80000, supplier_id: SUPPLIER_ID }],
  );
  const parsed: ParsedSku[] = [
    {
      slug,
      name: "Балка 25Б1 12м",
      diameter: 30, // ⚠ конфликт: 25 в БД, 30 в parsed
      length: 12000,
      steel_grade: "Ст3",
      dimensions: null,
      prices: [{ unit: "т", base_price: 80000 }],
    },
  ];

  const result = await reconcile(parsed, supabase as any, baseOptions);

  assert(result.new.length === 0, `new: expected 0, got ${result.new.length}`);
  assert(result.identicalDupes.length === 0, "identicalDupes: expected 0");
  assert(result.priceChanges.length === 0, "priceChanges: expected 0");
  assert(
    result.metadataConflicts.length === 1,
    `metadataConflicts: expected 1, got ${result.metadataConflicts.length}`,
  );

  const mc = result.metadataConflicts[0];
  assert(mc.slug === slug, "metadataConflict slug");
  assert(mc.diff_fields.includes("diameter"), `diff_fields includes diameter: ${mc.diff_fields}`);
}

async function caseDeepEqualJson() {
  // Sanity для helper.
  assert(deepEqualJson({ a: 1, b: 2 }, { b: 2, a: 1 }), "deepEqual ordering invariant");
  assert(!deepEqualJson({ a: 1 }, { a: 2 }), "deepEqual differs");
  assert(deepEqualJson(null, null), "deepEqual null");
  assert(deepEqualJson([1, 2, 3], [1, 2, 3]), "deepEqual arrays");
  assert(!deepEqualJson([1, 2], [1, 2, 3]), "deepEqual arrays differ length");
}

// ============================================================================
// Run
// ============================================================================

(async () => {
  console.log("\n=== reconcile helper tests ===\n");
  await test("case 1: new SKU", caseNew);
  await test("case 2: identical dupe (no-op)", caseIdenticalDupe);
  await test("case 3: price change (REPORT, no update)", casePriceChange);
  await test("case 4: metadata conflict (escalate)", caseMetadataConflict);
  await test("case 5: deepEqualJson sanity", caseDeepEqualJson);

  console.log(`\n  passed: ${passed}, failed: ${failed}`);
  if (failed > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("\n  ✅ all green");
  }
})().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

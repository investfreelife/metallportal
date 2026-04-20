/**
 * fill_weight_per_meter.js
 * Fetches all products, computes weight_per_meter from GOST tables,
 * updates records via Supabase service-role key.
 */

const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const SVC_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const H = { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, "Content-Type": "application/json" };

// ── ГОСТ таблицы (кг/м) ──────────────────────────────────────────────────────

// Арматура ГОСТ 5781-82 (кг/м)
const ARMATURA = { 6:0.222, 8:0.395, 10:0.617, 12:0.888, 14:1.208, 16:1.578,
  18:1.998, 20:2.466, 22:2.984, 25:3.853, 28:4.834, 32:6.313, 36:7.990, 40:9.865 };

// Круг стальной ГОСТ 2590-2006 (кг/м)
const KRUG = { 6:0.222, 7:0.302, 8:0.395, 9:0.499, 10:0.617, 11:0.746, 12:0.888,
  13:1.042, 14:1.208, 15:1.387, 16:1.578, 17:1.782, 18:1.998, 19:2.226, 20:2.466,
  21:2.719, 22:2.984, 24:3.551, 25:3.853, 26:4.168, 27:4.496, 28:4.834, 30:5.549,
  32:6.313, 34:7.127, 35:7.550, 36:7.990, 38:8.903, 40:9.865, 42:10.876, 45:12.486,
  48:14.205, 50:15.413, 52:16.670, 55:18.649, 56:19.322, 60:22.193, 63:24.472,
  65:26.044, 70:30.210, 75:34.680, 80:39.457, 85:44.543, 90:49.938, 95:55.640,
  100:61.650, 105:67.970, 110:74.597, 115:81.534, 120:88.826, 125:96.333,
  130:104.33, 135:112.34, 140:120.94, 145:129.74, 150:138.72 };

// Квадрат стальной ГОСТ 2591-2006 (кг/м)
const KVADRAT = { 6:0.283, 7:0.385, 8:0.502, 9:0.636, 10:0.785, 11:0.950, 12:1.130,
  13:1.327, 14:1.539, 15:1.766, 16:2.011, 17:2.272, 18:2.545, 19:2.835, 20:3.140,
  21:3.462, 22:3.799, 24:4.523, 25:4.906, 26:5.308, 27:5.726, 28:6.154, 30:7.065,
  32:8.038, 34:9.074, 35:9.616, 36:10.174, 38:11.335, 40:12.560, 42:13.847,
  45:15.896, 48:18.086, 50:19.625, 55:23.746, 56:24.618, 60:28.260, 63:31.186,
  65:33.166, 70:38.465, 75:44.156, 80:50.240, 85:56.712, 90:63.585, 95:70.850,
  100:78.500 };

// Шестигранник стальной ГОСТ 2879-2006 (кг/м)
const SHESTIGR = { 6:0.245, 7:0.333, 8:0.433, 9:0.548, 10:0.677, 11:0.819, 12:0.972,
  13:1.141, 14:1.323, 15:1.517, 16:1.727, 17:1.953, 18:2.191, 19:2.444, 20:2.712,
  22:3.287, 24:3.919, 25:4.253, 27:4.963, 28:5.338, 30:6.133, 32:6.983, 34:7.891,
  36:8.857, 38:9.881, 40:10.960, 42:12.100, 45:13.870, 46:14.490, 47:15.110,
  48:15.770, 50:17.090, 55:20.700, 56:21.450, 60:24.610, 63:27.130, 65:28.880,
  70:33.460, 75:38.450, 80:43.820 };

// Балка двутавровая ГОСТ 8239-89 (кг/м)
const BALKA = { 10:9.46, 12:11.50, 14:13.70, 16:15.90, 18:18.40, 20:21.00,
  22:24.00, 24:27.30, 27:31.50, 30:36.50, 33:42.20, 36:48.60, 40:57.00,
  45:66.50, 50:78.50, 55:91.00, 60:108.00 };

// Швеллер ГОСТ 8240-97 (кг/м)
const SHVELLER = { 5:4.84, 6.5:5.90, 8:7.05, 10:8.59, 12:10.40, 14:12.30,
  16:14.20, 18:16.30, 20:18.40, 22:21.00, 24:24.00, 27:27.70, 30:31.80,
  33:36.50, 36:41.90, 40:48.30 };

// Уголок равнополочный ГОСТ 8509-93 (кг/м) — ключ: "AxB"
const UGOLOK = {
  "20x3":0.889,"25x3":1.124,"25x4":1.459,"28x3":1.270,"30x3":1.360,
  "32x3":1.459,"32x4":1.921,"35x3":1.600,"35x4":2.109,"36x3":1.650,
  "36x4":2.163,"36x5":2.654,"40x3":1.811,"40x4":2.388,"40x5":2.940,
  "45x3":2.058,"45x4":2.714,"45x5":3.361,"50x3":2.305,"50x4":3.049,
  "50x5":3.769,"50x6":4.465,"56x4":3.421,"56x5":4.234,"63x4":3.870,
  "63x5":4.810,"63x6":5.720,"63x8":7.440,"70x5":5.380,"70x6":6.470,
  "70x7":7.410,"75x5":5.797,"75x6":6.905,"75x8":9.076,"80x5":6.190,
  "80x6":7.349,"80x8":9.680,"90x6":8.309,"90x7":9.650,"90x8":10.956,
  "100x6":9.275,"100x7":10.784,"100x8":12.270,"100x10":15.100,
  "100x12":18.000,"110x7":11.900,"110x8":13.520,"110x10":16.730,
  "125x8":15.500,"125x9":17.330,"125x10":19.100,"125x12":22.800,
  "140x9":19.500,"140x10":21.700,"140x12":25.800,"150x10":22.700,
  "150x12":27.100,"160x10":24.200,"160x11":26.600,"160x12":29.000,
  "180x11":30.200,"180x12":32.900,"180x13":35.600,"200x13":39.900,
  "200x14":42.900,"200x16":48.800 };

// ── Формулы для труб ──────────────────────────────────────────────────────────

// Труба круглая: w = (D - t) * t * 0.024661  [кг/м], D и t в мм
function pipeRound(D, t) {
  return Math.round((D - t) * t * 0.024661 * 1000) / 1000;
}

// Профильная труба: w = 2t*(a+b-2t) * 7.85e-3  [кг/м], a,b,t в мм
function pipeProfile(a, b, t) {
  return Math.round(2 * t * (a + b - 2 * t) * 0.00785 * 1000) / 1000;
}

// Балка широкополочная ГОСТ 26020-83 серия Б1 (кг/м)
const BALKA_B = { 10:8.1, 12:10.4, 14:12.9, 16:15.8, 18:18.4, 20:17.9, 23:22.3,
  25:25.7, 26:27.8, 30:32.5, 35:41.4, 40:52.7, 45:65.4, 50:82.0, 55:100.0, 60:122.0 };

// Швеллер специальный (кг/м) — для нестандартных размеров
const SHVELLER_EXT = { 55:59.0, 60:68.0 };

// Полоса стальная ГОСТ 103-2006: weight = width × thickness × 0.00785 кг/м
function polosa(width, thickness) {
  return Math.round(width * thickness * 0.00785 * 1000) / 1000;
}

// Водогазопроводная труба ГОСТ 3262-75 (кг/м) — ДУ размеры
const VGP = { 8:0.369, 10:0.476, 15:0.637, 20:0.930, 25:1.252, 32:1.659, 40:2.002,
  50:2.711, 65:3.500, 80:4.450, 90:5.200, 100:5.780, 125:8.250, 150:10.900 };

// ── Парсер имён ───────────────────────────────────────────────────────────────

function computeWeight(name) {
  const n = name;
  const lo = n.toLowerCase();

  // ─ Арматура ─
  if (/арматур/i.test(lo)) {
    const m = n.match(/[⌀Ø∅ø](\d+)/);
    if (m) return ARMATURA[+m[1]] || null;
  }

  // ─ Круг ─
  if (/^круг/i.test(lo)) {
    // Формат ⌀220 мм или просто 220 мм
    const m = n.match(/[⌀Ø∅ø](\d+)/) || n.match(/[^№\d](\d+)\s*мм/i);
    if (m) {
      const d = +m[1];
      if (KRUG[d]) return KRUG[d];
      // Для диаметров > 150 мм используем формулу: w = π/4 × d² × ρ
      if (d > 150) return Math.round(Math.PI / 4 * d * d * 7850e-6 * 1000) / 1000;
    }
  }

  // ─ Квадрат ─
  if (/^квадрат/i.test(lo)) {
    const m = n.match(/(\d+)\s*мм/i) || n.match(/\s(\d+)\s/);
    if (m) {
      const s = +m[1];
      if (KVADRAT[s]) return KVADRAT[s];
      if (s > 100) return Math.round(s * s * 7850e-6 * 1000) / 1000;
    }
  }

  // ─ Шестигранник ─
  if (/шестигран/i.test(lo)) {
    const m = n.match(/[⌀Ø∅ø ](\d+)/);
    if (m) {
      const d = +m[1];
      if (SHESTIGR[d]) return SHESTIGR[d];
      // Формула: w = √3/2 × d² × ρ (d — размер под ключ)
      if (d > 80) return Math.round(Math.sqrt(3)/2 * d * d * 7850e-6 * 1000) / 1000;
    }
  }

  // ─ Балка ─
  if (/^балка/i.test(lo)) {
    const m = n.match(/[№#](\d+)/);
    if (m) {
      const num = +m[1];
      // Попробуем серию Б (широкополочная)
      if (/Б\d/i.test(n)) return BALKA_B[num] || BALKA[num] || null;
      return BALKA[num] || BALKA_B[num] || null;
    }
  }

  // ─ Швеллер ─
  if (/^швеллер/i.test(lo)) {
    const m = n.match(/[№#]?(\d+(?:[.,]\d+)?)/);
    if (m) {
      const num = parseFloat(m[1].replace(",", "."));
      return SHVELLER[num] || SHVELLER_EXT[num] || null;
    }
  }

  // ─ Уголок ─
  if (/уголо/i.test(lo)) {
    // Формат "40×40×4" или "100×63×6"
    const m3 = n.match(/(\d+)[×xхx](\d+)[×xхx](\d+)/);
    if (m3) {
      const a = +m3[1], t = +m3[3];
      const key = `${a}x${t}`;
      if (UGOLOK[key]) return UGOLOK[key];
      // Fallback: формула для равнополочного ГОСТ 8509: w = (4t - t²/a) × a × 0.00785/1000 ≈ approx
    }
    // Формат "40х4 мм"
    const m2 = n.match(/(\d+)[×xхx](\d+)/);
    if (m2) {
      const key = `${m2[1]}x${m2[2]}`;
      return UGOLOK[key] || null;
    }
  }

  // ─ Полоса ─
  if (/^полос/i.test(lo)) {
    // Формат "120×4 мм" или "40х5"
    const m = n.match(/(\d+)[×xхx](\d+(?:[.,]\d+)?)/);
    if (m) return polosa(+m[1], parseFloat(m[2].replace(",", ".")));
  }

  // ─ Профильная труба ─
  if (/труб/i.test(lo) && /профил|прямоугол/i.test(lo)) {
    const m = n.match(/(\d+)[×xхx](\d+)[×xхx](\d+(?:[.,]\d+)?)/);
    if (m) return pipeProfile(+m[1], +m[2], parseFloat(m[3].replace(",", ".")));
  }

  // ─ Труба профильная (квадратная / прямоугольная) — AxBxT без слова профил ─
  if (/труб/i.test(lo)) {
    // Формат ⌀108×4.5 мм
    const mDxt = n.match(/[⌀Ø∅ø](\d+(?:[.,]\d+)?)[×xхx](\d+(?:[.,]\d+)?)/);
    if (mDxt) return pipeRound(parseFloat(mDxt[1]), parseFloat(mDxt[2].replace(",", ".")));

    // Формат "108 Ст20 ×4.5 мм" (бесшовная х/д, г/д)
    const mSpace = n.match(/(\d+)\s+\S+\s+[×xхx](\d+(?:[.,]\d+)?)\s*мм/i);
    if (mSpace) return pipeRound(+mSpace[1], parseFloat(mSpace[2].replace(",", ".")));

    // Формат "108 ×4.5 мм"
    const mSp2 = n.match(/(\d+)\s+[×xхx](\d+(?:[.,]\d+)?)\s*мм/i);
    if (mSp2) return pipeRound(+mSp2[1], parseFloat(mSp2[2].replace(",", ".")));

    // Профильная: AxBxT
    const mPP = n.match(/(\d+)[×xхx](\d+)[×xхx](\d+(?:[.,]\d+)?)/);
    if (mPP) return pipeProfile(+mPP[1], +mPP[2], parseFloat(mPP[3].replace(",", ".")));

    // Водогазопроводная ДУ
    const mDU = n.match(/ДУ\s*(\d+)/i);
    if (mDU) return VGP[+mDU[1]] || null;
  }

  // ─ Лист (sheet) — нет weight_per_meter ─
  if (/^лист/i.test(lo)) return null;

  return null;
}

// ── Основная логика ───────────────────────────────────────────────────────────

const BATCH = 100;

async function fetchAll() {
  let all = [];
  for (let offset = 0; ; offset += 500) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,unit,weight_per_meter&limit=500&offset=${offset}&order=id.asc`,
      { headers: H }
    );
    const batch = await r.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 500) break;
  }
  return all;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function patchOne(id, weight_per_meter, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
        method: "PATCH",
        headers: { ...H, "Prefer": "return=minimal" },
        body: JSON.stringify({ weight_per_meter }),
      });
      if (r.ok || r.status === 204) return;
      throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * attempt);
    }
  }
}

// Run at most `limit` promises concurrently
async function pAll(tasks, limit = 20) {
  let i = 0, ok = 0, fail = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < tasks.length) {
      const task = tasks[i++];
      try { await task(); ok++; } catch (e) { if (fail < 3) console.error("\nERR:", e.message); fail++; }
      process.stdout.write(`\r  Обновлено: ${ok+fail}/${tasks.length} (ok:${ok} err:${fail})`);
    }
  });
  await Promise.all(workers);
  return { ok, fail };
}

async function run() {
  console.log("Загружаем товары...");
  const all = await fetchAll();
  console.log(`Загружено товаров: ${all.length}`);

  const updates = [];
  const skipped = [];
  for (const p of all) {
    // не пропускаем — перезаписываем для исправления ошибки в формуле
    const w = computeWeight(p.name);
    if (w && w > 0) {
      updates.push({ id: p.id, weight_per_meter: w });
    } else {
      skipped.push(p.name);
    }
  }

  console.log(`Нужно обновить: ${updates.length}`);
  console.log(`Без веса (листы/прочее): ${skipped.length}`);
  const noSheet = skipped.filter(n => !/^лист/i.test(n) && !/навес|профнасти/i.test(n));
  if (noSheet.length) {
    console.log("Не распознано (не листы):", noSheet.length);
    noSheet.slice(0, 20).forEach(n => console.log("  -", n));
  }

  // Concurrent PATCH
  const tasks = updates.map(({ id, weight_per_meter }) => () => patchOne(id, weight_per_meter));
  const { ok, fail } = await pAll(tasks, 20);
  console.log(`\nГотово! Обновлено: ${ok}, ошибок: ${fail}`);
}

run().catch(console.error);

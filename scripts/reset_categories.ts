import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Transliteration ──────────────────────────────────────────────────────────

const TRANSLIT_MAP: Record<string, string> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh',
  з:'z', и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o',
  п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'kh', ц:'ts',
  ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
};

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map(c => TRANSLIT_MAP[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Deduplicator for unique slugs across the whole insert batch
const usedSlugs = new Set<string>();
function uniqueSlug(base: string): string {
  let slug = base;
  let i = 2;
  while (usedSlugs.has(slug)) slug = `${base}-${i++}`;
  usedSlugs.add(slug);
  return slug;
}

// ── Parse catalog file ────────────────────────────────────────────────────────

interface Section {
  name: string;
  slug: string;
  subsections: { name: string; slug: string }[];
}

function parseCatalog(filePath: string): Section[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');

  // section name → Section
  const sectionsMap = new Map<string, Section>();
  const sectionOrder: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('КАТАЛОГ /')) continue;

    const parts = line.split(' / ');
    if (parts.length < 3) continue;

    const sectionName = parts[1].trim();
    const subsectionName = parts[2].trim();

    if (!sectionsMap.has(sectionName)) {
      const sectionSlug = uniqueSlug(toSlug(sectionName));
      sectionsMap.set(sectionName, { name: sectionName, slug: sectionSlug, subsections: [] });
      sectionOrder.push(sectionName);
    }

    const section = sectionsMap.get(sectionName)!;
    // Avoid duplicate subsections within the same section
    if (!section.subsections.find(s => s.name === subsectionName)) {
      const subSlug = uniqueSlug(toSlug(subsectionName));
      section.subsections.push({ name: subsectionName, slug: subSlug });
    }
  }

  return sectionOrder.map(name => sectionsMap.get(name)!);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const catalogFile = path.resolve(process.cwd(), 'data/каталог_3_уровня.txt');
  const sections = parseCatalog(catalogFile);
  console.log(`Parsed: 1 root + ${sections.length} sections + ${sections.reduce((n, s) => n + s.subsections.length, 0)} subsections`);

  // ── 1. Вставляем временную заглушку ─────────────────────────────────────
  console.log('\n[1] Вставляем временную заглушку...');
  const { data: tempData, error: tempErr } = await supabase
    .from('categories')
    .insert({ name: '_temp_', slug: 'temp-delete-me', parent_id: null, sort_order: 0, is_active: false })
    .select('id')
    .single();
  if (tempErr) throw new Error(`Insert temp: ${tempErr.message}`);
  const tempId = tempData.id;
  console.log(`    temp id=${tempId} ✓`);

  // ── 2. Переводим все products на заглушку ────────────────────────────────
  console.log('[2] Переводим products.category_id → заглушка...');
  const { error: remapErr } = await supabase
    .from('products')
    .update({ category_id: tempId })
    .neq('category_id', tempId);
  if (remapErr) throw new Error(`Remap products: ${remapErr.message}`);
  console.log('    ✓');

  // ── 3. Удаляем все категории кроме заглушки ──────────────────────────────
  console.log('[3] Удаляем все категории кроме заглушки...');
  const { error: delLeafErr } = await supabase
    .from('categories')
    .delete()
    .not('parent_id', 'is', null);
  if (delLeafErr) throw new Error(`Delete leaf categories: ${delLeafErr.message}`);
  const { error: delRootsErr } = await supabase
    .from('categories')
    .delete()
    .is('parent_id', null)
    .neq('id', tempId);
  if (delRootsErr) throw new Error(`Delete root categories: ${delRootsErr.message}`);
  console.log('    ✓');

  // ── 4. Вставляем Металлопрокат ───────────────────────────────────────────
  console.log('[4] Вставляем Металлопрокат...');
  const { data: rootData, error: rootErr } = await supabase
    .from('categories')
    .insert({ name: 'Металлопрокат', slug: 'metalloprokat', parent_id: null, sort_order: 1, is_active: true })
    .select('id')
    .single();
  if (rootErr) throw new Error(`Insert root: ${rootErr.message}`);
  const rootId = rootData.id;
  console.log(`    [L1] "Металлопрокат" → id=${rootId}`);

  // ── 4. Вставляем разделы (L2) и подразделы (L3) ──────────────────────────
  let l2count = 0;
  let l3count = 0;

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];

    const { data: secData, error: secErr } = await supabase
      .from('categories')
      .insert({
        name: sec.name,
        slug: sec.slug,
        parent_id: rootId,
        sort_order: si + 1,
        is_active: true,
      })
      .select('id')
      .single();
    if (secErr) throw new Error(`Insert section "${sec.name}": ${secErr.message}`);
    l2count++;

    const secId = secData.id;

    // Insert subsections (L3)
    for (let ssi = 0; ssi < sec.subsections.length; ssi++) {
      const sub = sec.subsections[ssi];
      const { error: subErr } = await supabase
        .from('categories')
        .insert({
          name: sub.name,
          slug: sub.slug,
          parent_id: secId,
          sort_order: ssi + 1,
          is_active: true,
        });
      if (subErr) throw new Error(`Insert subsection "${sub.name}": ${subErr.message}`);
      l3count++;
    }

    process.stdout.write(`  [L2] ${sec.name} (${sec.subsections.length} subsections)\n`);
  }

  // ── 5. Удаляем заглушку (products остаются на Металлопрокате) ───────────
  console.log('[5] Переводим products → Металлопрокат, удаляем заглушку...');
  const { error: remapRootErr } = await supabase
    .from('products')
    .update({ category_id: rootId })
    .eq('category_id', tempId);
  if (remapRootErr) throw new Error(`Remap to root: ${remapRootErr.message}`);
  const { error: delTempErr } = await supabase
    .from('categories')
    .delete()
    .eq('id', tempId);
  if (delTempErr) throw new Error(`Delete temp: ${delTempErr.message}`);
  console.log('    ✓');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('ИТОГ:');
  console.log(`  Уровень 1 (корень):     1  (Металлопрокат)`);
  console.log(`  Уровень 2 (разделы):   ${String(l2count).padStart(2)}  (${sections.map(s => s.name).join(', ')})`);
  console.log(`  Уровень 3 (подразделы): ${l3count}`);
  console.log(`  ИТОГО категорий:        ${1 + l2count + l3count}`);
  console.log('════════════════════════════════════════');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

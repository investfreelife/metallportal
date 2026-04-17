import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Count with exact flag
  const { count: totalCount } = await sb.from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  console.log(`Total active products in DB: ${totalCount}`);

  const { count: inactiveCount } = await sb.from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false);
  console.log(`Inactive products: ${inactiveCount}`);

  const { count: totalAll } = await sb.from('products')
    .select('*', { count: 'exact', head: true });
  console.log(`Total all products: ${totalAll}`);

  // Count per category using exact count
  const { data: cats } = await sb.from('categories').select('id, slug, name');
  if (!cats) return;

  console.log('\n=== CATEGORIES WITH PRODUCTS ===');
  const results: { slug: string; name: string; cnt: number }[] = [];

  for (const c of cats) {
    const { count } = await sb.from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', c.id)
      .eq('is_active', true);
    results.push({ slug: c.slug, name: c.name, cnt: count || 0 });
  }

  results.sort((a, b) => b.cnt - a.cnt);
  for (const r of results) {
    if (r.cnt > 0) console.log(`  ${String(r.cnt).padStart(5)}  ${r.slug}`);
  }

  const empty = results.filter(r => r.cnt === 0);
  console.log(`\nEmpty categories: ${empty.length}`);
  console.log('Non-empty categories: ' + results.filter(r => r.cnt > 0).length);
}

main().catch(e => { console.error(e); process.exit(1); });

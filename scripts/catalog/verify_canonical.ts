/**
 * c025 — Canonical catalog structure verification.
 *
 * Per LAW-catalog-structure-lock: structure is single-source-of-truth в
 * `knowledge-base/catalog/canonical_structure.json`. This script regenerates
 * the same JSON shape from the DB and diffs against committed canonical.
 *
 * Usage (CI или local):
 *   set -a && source metallportal/.env.local && set +a
 *   npx ts-node metallportal/scripts/catalog/verify_canonical.ts
 *
 * Exit codes:
 *   0 — DB matches canonical_structure.json ✓
 *   1 — drift detected (DB or JSON modified без the other) ❌
 *   2 — connection / config error
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *
 * Used by `.github/workflows/catalog-canonical-check.yml` (daily + on PR).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

type Cat = {
  id: string
  slug: string
  name: string
  parent_id: string | null
  is_active: boolean
  sort_order: number | null
  display_section: 'metallоprokat' | 'constructions'
}

type CanonicalNode = { slug: string; name: string; children?: CanonicalNode[] }
type Canonical = {
  version: string
  last_modified: string
  modified_by_sergey_command: boolean
  sections: {
    metallоprokat: CanonicalNode[]
    constructions: CanonicalNode[]
  }
}

function loadEnv() {
  // Allow running from repo root or from metallportal/
  for (const p of ['.env.local', 'metallportal/.env.local', '../.env.local']) {
    try {
      const env = readFileSync(join(process.cwd(), p), 'utf-8')
      for (const line of env.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        const v = t
          .slice(eq + 1)
          .trim()
          .replace(/^["']|["']$/g, '')
        if (!process.env[k]) process.env[k] = v
      }
      return
    } catch {
      /* try next */
    }
  }
}

function buildSection(cats: Cat[], section: 'metallоprokat' | 'constructions'): CanonicalNode[] {
  const filtered = cats.filter((c) => c.display_section === section && c.is_active)
  const byParent = new Map<string | null, Cat[]>()
  for (const c of filtered) {
    const arr = byParent.get(c.parent_id) ?? []
    arr.push(c)
    byParent.set(c.parent_id, arr)
  }
  byParent.forEach((arr) => {
    arr.sort((a: Cat, b: Cat) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  })
  const build = (parentId: string | null): CanonicalNode[] => {
    const kids = byParent.get(parentId) ?? []
    return kids.map((c) => {
      const children = build(c.id)
      const node: CanonicalNode = { slug: c.slug, name: c.name }
      if (children.length > 0) node.children = children
      return node
    })
  }
  return build(null)
}

function deepNormalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepNormalise)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) {
      const v = obj[k]
      // omit empty children arrays для DB→JSON parity (LAW JSON omits children: [])
      if (k === 'children' && Array.isArray(v) && v.length === 0) continue
      out[k] = deepNormalise(v)
    }
    return out
  }
  return value
}

async function main() {
  loadEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(2)
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await sb
    .from('categories')
    .select('id, slug, name, parent_id, is_active, sort_order, display_section')
    .eq('is_active', true)
  if (error || !data) {
    console.error('DB error:', error?.message ?? 'no data')
    process.exit(2)
  }
  const cats = data as Cat[]

  const dbStructure = {
    sections: {
      metallоprokat: buildSection(cats, 'metallоprokat'),
      constructions: buildSection(cats, 'constructions'),
    },
  }

  // Read committed canonical (repo-local copy в metallportal/knowledge-base/).
  // The shared `/Users/Shared/металл/knowledge-base/catalog/...` копия —
  // working-tree convenience; CI uses repo-local copy в metallportal.
  const canonicalPath = join(
    process.cwd(),
    'knowledge-base/catalog/canonical_structure.json',
  )
  let canonicalRaw: string
  try {
    canonicalRaw = readFileSync(canonicalPath, 'utf-8')
  } catch (e) {
    console.error(`Cannot read ${canonicalPath}:`, e instanceof Error ? e.message : e)
    process.exit(2)
  }
  const canonical = JSON.parse(canonicalRaw) as Canonical

  // Compare ONLY sections (version / last_modified / modified_by_sergey_command
  // are metadata — drift in metadata is OK between commits).
  const a = JSON.stringify(deepNormalise(canonical.sections), null, 2)
  const b = JSON.stringify(deepNormalise(dbStructure.sections), null, 2)

  if (a === b) {
    console.log('✓ DB structure matches canonical_structure.json')
    console.log(`  metallоprokat: ${dbStructure.sections.metallоprokat.length} L1 categories`)
    console.log(`  constructions: ${dbStructure.sections.constructions.length} L1 categories`)
    process.exit(0)
  }

  console.error('✗ DRIFT DETECTED — DB structure ≠ canonical_structure.json')
  console.error('')
  console.error('--- Canonical ---')
  console.error(a.slice(0, 2000))
  console.error('')
  console.error('--- DB ---')
  console.error(b.slice(0, 2000))
  console.error('')
  console.error('Resolve путём:')
  console.error('  - regenerate JSON from DB (если DB intentional)')
  console.error('  - run migration (если canonical authoritative)')
  console.error('  - per LAW-catalog-structure-lock — Sergey command required')
  process.exit(1)
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(2)
})

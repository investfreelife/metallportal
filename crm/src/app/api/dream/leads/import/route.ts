import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/dream/leads/import — bulk import от парсера.
 *
 * Парсер «Мечта» (bd_pipeline.py / parser_moscow.py) POSTит сюда массив
 * лидов сразу после enrichment. Auth: x-agent-token (AGENT_WEBHOOK_TOKEN).
 *
 * Body:
 *   {
 *     "run_id": optional bigint (если зарегистрирован dream_parser_runs),
 *     "leads": [
 *       {
 *         "slug": "avtoclean",
 *         "name": "Avtoclean",
 *         "niche": "Автомойка",
 *         ... все поля dream_leads ...
 *         "folder_path": "/path/to/landings/<slug>"
 *       }
 *     ]
 *   }
 *
 * Upsert by slug — повторный run обновит данные не задевая sales workflow
 * (status, notes, price, contacted_at, sold_at сохраняются).
 */

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const ALLOWED_KEYS = [
  'slug', 'name', 'niche', 'category_key',
  'city', 'address', 'metro_nearest', 'geo_lat', 'geo_lon',
  'phone', 'phone_display', 'email', 'yandex_url', 'yandex_id', 'gis_url',
  'has_website', 'website_url', 'social_json',
  'rating', 'reviews_count', 'ratings_count', 'services_count', 'photos_count',
  'features_json', 'hours_json', 'description_short', 'description_long',
  'completeness_score',
  'folder_path', 'landing_html_path', 'landing_deployed_url',
  'enrichment_sources', 'parser_run_id',
] as const

function checkAuth(req: NextRequest): { ok: true } | { ok: false; error: NextResponse } {
  const token = req.headers.get('x-agent-token')
  const expected = process.env.AGENT_WEBHOOK_TOKEN
  if (expected && token && token === expected) return { ok: true }
  return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function POST(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return auth.error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const leadsIn = Array.isArray(body?.leads) ? body.leads : []
  if (leadsIn.length === 0) {
    return NextResponse.json({ error: 'leads array required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let imported = 0
  let updated = 0
  let errors: string[] = []

  for (const raw of leadsIn) {
    if (!raw.slug) {
      errors.push('lead without slug')
      continue
    }
    const cleaned: Record<string, any> = { tenant_id: DREAM_TENANT_ID }
    for (const key of ALLOWED_KEYS) {
      if (raw[key] !== undefined) cleaned[key] = raw[key]
    }
    cleaned.enriched_at = new Date().toISOString()
    if (body.run_id) cleaned.parser_run_id = body.run_id

    // Upsert
    const { data: existing } = await supabase
      .from('dream_leads')
      .select('id, status')
      .eq('slug', raw.slug)
      .maybeSingle()

    if (existing) {
      // Don't override sales workflow status (only if status='new' → 'enriched')
      const patch = { ...cleaned }
      if (existing.status !== 'new') delete patch.status
      const { error } = await supabase
        .from('dream_leads')
        .update(patch)
        .eq('id', existing.id)
      if (error) errors.push(`${raw.slug}: ${error.message}`)
      else updated++
    } else {
      const { error } = await supabase
        .from('dream_leads')
        .insert({ ...cleaned, status: cleaned.status ?? 'enriched' })
      if (error) errors.push(`${raw.slug}: ${error.message}`)
      else imported++
    }
  }

  return NextResponse.json({ ok: true, imported, updated, errors })
}

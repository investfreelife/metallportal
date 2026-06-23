import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { requireDreamAuth } from '@/lib/dream/requireAuth'

/**
 * GET /api/dream/leads/[slug] — карточка одного лида + связанные данные.
 *
 * Возвращает:
 *   - lead (полные поля из dream_leads)
 *   - activities (history)
 *   - status_history (audit)
 *   - landing_files: { reviews, services, photos_meta }
 *     (читаем reviews.json / services.json / photos manifest с диска через
 *     folder_path — не дублируем в БД).
 */

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function readJsonSafe(p: string): Promise<any> {
  try {
    const buf = await fs.readFile(p, 'utf-8')
    return JSON.parse(buf)
  } catch {
    return null
  }
}

async function listPhotos(folder: string): Promise<string[]> {
  try {
    const photosDir = path.join(folder, 'photos')
    const entries = await fs.readdir(photosDir)
    return entries
      .filter((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))
      .sort()
      .map((f) => path.join(photosDir, f))
  } catch {
    return []
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // TASK_030 #3: defence-in-depth auth.
  const __auth = await requireDreamAuth(_req)
  if (!__auth.ok) return __auth.res

  const { slug } = await params
  const supabase = admin()

  const { data: lead, error } = await supabase
    .from('dream_leads')
    .select('*')
    .eq('tenant_id', DREAM_TENANT_ID)
    .eq('slug', slug)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: activities }, { data: statusHistory }] = await Promise.all([
    supabase
      .from('dream_activities')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('dream_status_history')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Read landing files from disk
  let landing_files: any = { reviews: null, services: null, photos: [] }
  if (lead.folder_path) {
    const [reviews, services, photos] = await Promise.all([
      readJsonSafe(path.join(lead.folder_path, 'reviews.json')),
      readJsonSafe(path.join(lead.folder_path, 'services.json')),
      listPhotos(lead.folder_path),
    ])
    landing_files = { reviews, services, photos }
  }

  return NextResponse.json(
    {
      lead,
      activities: activities ?? [],
      status_history: statusHistory ?? [],
      landing_files,
    },
    { headers: { 'cache-control': 'no-store' } }
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // TASK_030 #3: defence-in-depth auth.
  const __auth = await requireDreamAuth(req)
  if (!__auth.ok) return __auth.res

  const { slug } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // TASK_015: расширили список редактируемых полей под Досье.
  const allowed = [
    'notes', 'price', 'tags', 'ai_summary', 'ai_pitch', 'assigned_to', 'priority',
    // §4.5 + TASK_015: контакт + ЛПР + интерес + воронка + дожим
    'contact_name', 'contact_position', 'contact_email',
    'decision_maker_name', 'decision_maker_phone',
    'preferred_channel', 'interest',
    'sales_stage', 'qualification',
    'next_action_at', 'next_action_goal', 'next_action_by',
    'callback_at', 'description_short', 'description_long', 'website_url',
    // TASK_018: ниша редактируется на карточке
    'niche', 'name', 'address', 'metro_nearest',
  ]
  const patch: Record<string, any> = {}
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k]
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const supabase = admin()
  const { error } = await supabase
    .from('dream_leads')
    .update(patch)
    .eq('tenant_id', DREAM_TENANT_ID)
    .eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

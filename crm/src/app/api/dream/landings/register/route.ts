import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/dream/landings/register — агент-кодер регистрирует новый
 * вариант лендинга после генерации и загрузки файлов в Storage.
 *
 * Headers: x-agent-token (AGENT_WEBHOOK_TOKEN)
 *
 * Body:
 * {
 *   lead_slug: "avtoclean",
 *   variant:   "modern",
 *   version:   "v1",
 *   template_id: "autoservice_modern_v1",
 *   storage_prefix: "avtoclean/modern-v1/",
 *   pages: [
 *     {slug:"index",    title:"Главная",  storage_path:"avtoclean/modern-v1/index.html"},
 *     {slug:"services", title:"Услуги",   storage_path:"avtoclean/modern-v1/services.html"},
 *     {slug:"gallery",  title:"Фото",     storage_path:"avtoclean/modern-v1/gallery.html"},
 *     {slug:"reviews",  title:"Отзывы",   storage_path:"avtoclean/modern-v1/reviews.html"},
 *     {slug:"contacts", title:"Контакты", storage_path:"avtoclean/modern-v1/contacts.html"}
 *   ],
 *   meta: {generator_model, color_scheme, hero_style, ai_cost_usd, duration_sec},
 *   set_chosen: false   // если true — этот вариант станет активным сразу
 * }
 *
 * Возвращает: { ok, landing_id, urls: {index, services, ...} }
 */

const SUPA_PUBLIC = 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/dream-landings/'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-agent-token') !== process.env.AGENT_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { lead_slug, variant, version = 'v1', template_id, storage_prefix, pages, meta, set_chosen } = body
  if (!lead_slug || !variant || !storage_prefix || !Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: 'lead_slug, variant, storage_prefix, pages[] required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // resolve lead
  const { data: lead } = await supabase
    .from('dream_leads').select('id, tenant_id').eq('slug', lead_slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  // enrich pages with public URL
  const enrichedPages = pages.map((p: any) => ({
    slug: p.slug,
    title: p.title || p.slug,
    storage_path: p.storage_path,
    url: SUPA_PUBLIC + p.storage_path,
    bytes: p.bytes ?? null,
  }))
  const indexPage = enrichedPages.find((p: any) => p.slug === 'index') || enrichedPages[0]

  const row = {
    lead_id: lead.id,
    tenant_id: lead.tenant_id,
    variant,
    version,
    template_id: template_id ?? null,
    storage_prefix,
    entry_url: indexPage.url,
    pages: enrichedPages,
    meta: meta ?? {},
    status: 'published',
    is_chosen: !!set_chosen,
  }

  const { data: existing } = await supabase
    .from('dream_landings').select('id')
    .eq('lead_id', lead.id).eq('variant', variant).eq('version', version).maybeSingle()

  let landingId: number
  if (existing) {
    const { data, error } = await supabase
      .from('dream_landings').update(row).eq('id', existing.id).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    landingId = data!.id
  } else {
    const { data, error } = await supabase
      .from('dream_landings').insert(row).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    landingId = data!.id
  }

  return NextResponse.json({
    ok: true,
    landing_id: landingId,
    entry_url: indexPage.url,
    urls: Object.fromEntries(enrichedPages.map((p: any) => [p.slug, p.url])),
  })
}

/** GET /api/dream/landings/register?lead_slug=avtoclean — все варианты лида */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('lead_slug')
  if (!slug) return NextResponse.json({ error: 'lead_slug required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: lead } = await supabase
    .from('dream_leads').select('id').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ landings: [] })

  const { data } = await supabase
    .from('dream_landings').select('*')
    .eq('lead_id', lead.id).order('generated_at', { ascending: false })

  return NextResponse.json({ landings: data ?? [] })
}

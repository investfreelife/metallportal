import Link from 'next/link'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import LeadCardClient from './LeadCardClient'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

async function readJsonSafe(p: string) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf-8'))
  } catch {
    return null
  }
}

async function readPhotosAsDataUris(folder: string, limit = 40): Promise<string[]> {
  try {
    const photosDir = path.join(folder, 'photos')
    const entries = (await fs.readdir(photosDir))
      .filter((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))
      .sort()
      .slice(0, limit)
    const uris: string[] = []
    for (const name of entries) {
      try {
        const buf = await fs.readFile(path.join(photosDir, name))
        uris.push(`data:image/jpeg;base64,${buf.toString('base64')}`)
      } catch {}
    }
    return uris
  } catch {
    return []
  }
}

export default async function LeadCardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: lead } = await supabase
    .from('dream_leads')
    .select('*')
    .eq('tenant_id', DREAM_TENANT_ID)
    .eq('slug', slug)
    .maybeSingle()

  if (!lead) return notFound()

  const [{ data: activities }, { data: statusHistory }] = await Promise.all([
    supabase.from('dream_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('dream_status_history').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20),
  ])

  // Sergey directive 2026-06-17/18: всё читаем из Supabase (нормализованные таблицы).
  // Heavy/Temp файлы — НЕ в Storage, только URL/метаданные (Yandex CDN / raw.github / investfreelife.github.io).
  const [
    photosRes,
    reviewsRes,
    servicesRes,
    landingsRes,
    commentsRes,
  ] = await Promise.all([
    supabase.from('dream_lead_photos').select('idx, url, width, height, priority, deleted, note').eq('lead_id', lead.id).order('idx'),
    supabase.from('dream_lead_reviews').select('idx, author, rating, review_date, text').eq('lead_id', lead.id).order('idx'),
    supabase.from('dream_lead_services').select('idx, name, price, unit, source, is_default').eq('lead_id', lead.id).order('idx'),
    supabase.from('dream_landings')
      .select('id, variant, version, template_id, entry_url, storage_prefix, pages, meta, status, is_chosen, generated_at')
      .eq('lead_id', lead.id)
      .order('is_chosen', { ascending: false })
      .order('generated_at', { ascending: false }),
    supabase.from('dream_lead_comments')
      .select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }),
  ])

  const photosRows   = photosRes.data
  const reviewsRows  = reviewsRes.data
  const servicesRows = servicesRes.data
  const landings     = landingsRes.data ?? []
  const comments     = commentsRes.data ?? []

  const photos = (photosRows ?? []).map((p: any) => ({
    idx: p.idx, url: p.url, priority: !!p.priority, deleted: !!p.deleted, note: p.note,
  }))
  const photoUris: string[] = photos.filter((p) => !p.deleted).map((p) => p.url)
  const services = (servicesRows ?? []).map((s: any) => ({
    name: s.name, price: s.price, unit: s.unit, source: s.source, is_default: s.is_default,
  }))
  const reviews = reviewsRows && reviewsRows.length > 0
    ? {
        rating: lead.rating,
        count: lead.reviews_count,
        sample: (reviewsRows as any[]).map((r) => ({
          author: r.author, rating: r.rating, date: r.review_date, text: r.text,
        })),
      }
    : null

  // Dev fallback — если в БД пусто, попробовать диск (только локально)
  if (lead.folder_path && photoUris.length === 0) {
    try {
      const fallbackReviews = await readJsonSafe(path.join(lead.folder_path, 'reviews.json'))
      const serv = await readJsonSafe(path.join(lead.folder_path, 'services.json'))
      if (Array.isArray(serv)) services.push(...serv)
      photoUris.push(...(await readPhotosAsDataUris(lead.folder_path)))
      if (!reviews && fallbackReviews) {
        ;(globalThis as any).__diskFallback = fallbackReviews
      }
    } catch {}
  }

  return (
    <LeadCardClient
      lead={lead}
      activities={activities ?? []}
      statusHistory={statusHistory ?? []}
      reviews={reviews}
      services={services}
      photoUris={photoUris}
      photos={photos}
      landings={landings}
      comments={comments}
    />
  )
}

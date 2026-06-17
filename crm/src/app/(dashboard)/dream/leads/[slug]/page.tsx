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

  // Disk-side files
  let reviews: any = null
  let services: any[] = []
  let photoUris: string[] = []
  if (lead.folder_path) {
    reviews = await readJsonSafe(path.join(lead.folder_path, 'reviews.json'))
    const serv = await readJsonSafe(path.join(lead.folder_path, 'services.json'))
    if (Array.isArray(serv)) services = serv
    photoUris = await readPhotosAsDataUris(lead.folder_path)
  }

  return (
    <LeadCardClient
      lead={lead}
      activities={activities ?? []}
      statusHistory={statusHistory ?? []}
      reviews={reviews}
      services={services}
      photoUris={photoUris}
    />
  )
}

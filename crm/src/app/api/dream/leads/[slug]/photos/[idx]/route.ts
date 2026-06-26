import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * PATCH /api/dream/leads/[slug]/photos/[idx]
 * body: { priority?: boolean, deleted?: boolean, note?: string }
 *
 * Sergey directive 2026-06-18: пометить фото мусором (🗑) или приоритетом (⭐)
 * прямо из карточки лида. Используется агентами-кодерами при выборе фото
 * для лендинга.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; idx: string }> }
) {
  const { slug, idx: idxStr } = await params
  const idx = parseInt(idxStr, 10)
  if (!Number.isFinite(idx)) return NextResponse.json({ error: 'invalid idx' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, any> = {}
  if (typeof body.priority === 'boolean') update.priority = body.priority
  if (typeof body.deleted  === 'boolean') update.deleted  = body.deleted
  if (typeof body.note     === 'string')  update.note     = body.note
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: lead } = await supabase.from('dream_leads').select('id').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('dream_lead_photos')
    .update(update)
    .eq('lead_id', lead.id)
    .eq('idx', idx)
    .select('idx, priority, deleted, note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, photo: data })
}

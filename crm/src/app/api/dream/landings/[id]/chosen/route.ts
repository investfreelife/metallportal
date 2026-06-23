import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireDreamAuth } from '@/lib/dream/requireAuth'

/**
 * POST /api/dream/landings/[id]/chosen
 * Делает этот вариант chosen=TRUE. Триггер snimaет с остальных + обновляет
 * dream_leads.landing_public_url. Sergey directive 2026-06-18 — лид имеет
 * несколько вариантов, оператор выбирает активный.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // TASK_030 #3: defence-in-depth auth.
  const __auth = await requireDreamAuth(_req)
  if (!__auth.ok) return __auth.res

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase
    .from('dream_landings')
    .update({ is_chosen: true })
    .eq('id', id)
    .select('id, variant, version, entry_url, is_chosen')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, landing: data })
}

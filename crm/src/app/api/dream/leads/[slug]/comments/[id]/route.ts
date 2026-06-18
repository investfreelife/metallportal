import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** PATCH /api/dream/leads/[slug]/comments/[id]  body: {is_resolved?: boolean, text?: string, kind?: string} */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  const body = await req.json().catch(() => ({}))

  const upd: Record<string, any> = {}
  if (typeof body.text === 'string')     upd.text     = body.text
  if (typeof body.kind === 'string')     upd.kind     = body.kind
  if (typeof body.is_resolved === 'boolean') {
    upd.is_resolved = body.is_resolved
    if (body.is_resolved) {
      upd.resolved_at = new Date().toISOString()
      upd.resolved_by = session.login
    } else {
      upd.resolved_at = null
      upd.resolved_by = null
    }
  }
  if (Object.keys(upd).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const { data, error } = await admin()
    .from('dream_lead_comments').update(upd).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comment: data })
}

/** DELETE /api/dream/leads/[slug]/comments/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  const sb = admin()
  // Снять attachment из Storage
  const { data: c } = await sb.from('dream_lead_comments').select('attachment_path').eq('id', id).maybeSingle()
  if (c?.attachment_path) {
    await sb.storage.from('dream-comments').remove([c.attachment_path])
  }
  const { error } = await sb.from('dream_lead_comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

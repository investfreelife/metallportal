/**
 * Комментарии и фото-вложения на лидах Мечты.
 *
 * Зачем: оператор / агент на любом этапе оставляет заметку
 *   ('note' / 'fact' / 'issue' / 'blocker') про лида + опционально фото.
 *   Если kind='blocker' — агент-парсер и агент-кодер ОТКАЗЫВАЮТСЯ
 *   работать по лиду пока is_resolved=false (см. VIEW dream_lead_blockers).
 *
 * Authentication:
 *   - cookie-session    → оператор (Sergey)
 *   - x-agent-token     → агенты (передают также x-agent-name)
 *
 * Тело запроса:
 *   а) JSON: {text, kind, attachment_url?}
 *   б) FormData (multipart): text, kind, file?  (file ≤300KB, image/*)
 *      файл льётся в bucket dream-comments (Supabase Storage, public)
 *
 * См. ARCHITECTURE.md и /dream/docs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const STORAGE_PUBLIC = 'https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/dream-comments/'

/** GET /api/dream/leads/[slug]/comments */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = admin()
  const { data: lead } = await sb.from('dream_leads').select('id').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const { data } = await sb
    .from('dream_lead_comments')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
  return NextResponse.json({ comments: data ?? [] })
}

/** POST /api/dream/leads/[slug]/comments
 *  multipart/form-data: text, kind, file?
 *  ИЛИ application/json: {text, kind, attachment_url?}
 *
 *  Auth: cookie-session (Sergey) или x-agent-token (агент).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  const agentToken = req.headers.get('x-agent-token')
  const isAgent = agentToken === process.env.AGENT_WEBHOOK_TOKEN
  if (!session && !isAgent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const author = isAgent
    ? (req.headers.get('x-agent-name') || 'agent:unknown')
    : (session?.login ?? 'operator')

  const sb = admin()
  const { data: lead } = await sb.from('dream_leads').select('id, tenant_id').eq('slug', slug).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  let text = ''
  let kind = 'note'
  let attachment_url: string | null = null
  let attachment_path: string | null = null
  let attachment_bytes: number | null = null

  const contentType = req.headers.get('content-type') || ''
  if (contentType.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    text = String(fd.get('text') || '').trim()
    kind = String(fd.get('kind') || 'note')
    const file = fd.get('file')
    if (file && typeof file !== 'string') {
      // Лимит 5 MB (бакет тоже на 5 MB). Pro-план Supabase позволяет.
      if (file.size > 5_242_880) {
        return NextResponse.json({ error: 'Файл больше 5 MB. Уменьши перед отправкой.' }, { status: 413 })
      }
      const ext = (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg')
      const key = `${slug}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await sb.storage
        .from('dream-comments')
        .upload(key, buf, { contentType: file.type, upsert: false })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
      attachment_path = key
      attachment_url = STORAGE_PUBLIC + key
      attachment_bytes = file.size
    }
  } else {
    const body = await req.json().catch(() => ({}))
    text = String(body.text || '').trim()
    kind = String(body.kind || 'note')
    attachment_url = body.attachment_url || null
  }

  if (!text && !attachment_url) {
    return NextResponse.json({ error: 'Текст или файл обязателен' }, { status: 400 })
  }
  if (!['note','fact','issue','blocker'].includes(kind)) {
    return NextResponse.json({ error: 'kind должен быть note/fact/issue/blocker' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('dream_lead_comments')
    .insert({
      lead_id: lead.id, tenant_id: lead.tenant_id,
      author, kind, text,
      attachment_url, attachment_path, attachment_bytes,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comment: data })
}

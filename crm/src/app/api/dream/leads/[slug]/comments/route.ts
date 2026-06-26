/**
 * Комментарии и фото-вложения на лидах Мечты.
 *
 * ЗАКОН (Sergey directive 2026-06-18 redux): тяжёлые файлы НЕ в Supabase.
 * Фото-вложения комментариев → GitHub репо `dream-landings`, путь
 *   <slug>/comments/<unique>.<ext>
 * URL → raw.githubusercontent.com/investfreelife/dream-landings/main/...
 *
 * Лимит файла: 20 MB (GitHub Contents API поддерживает до 100 MB, но мы
 * перестрахуемся). Базовый client-side ресайз только если очень крупный.
 *
 * Authentication:
 *   - cookie-session    → оператор (Sergey)
 *   - x-agent-token     → агенты (передают также x-agent-name)
 *
 * Тело запроса:
 *   а) JSON: {text, kind, attachment_url?}
 *   б) FormData (multipart): text, kind, file?
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

// Параметры GitHub-стораджа (по ЗАКОНУ — тяжёлые файлы тут, не в Supabase)
const GH_OWNER = 'investfreelife'
const GH_REPO  = 'dream-landings'
const RAW_BASE = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/`

/**
 * Загрузить файл в GitHub репо через Contents API.
 * Возвращает {url, path}. Бросает Error если упало.
 */
async function uploadToGitHub(path: string, content: Buffer, message: string) {
  const token = process.env.DREAM_STORAGE_GH_TOKEN
  if (!token) throw new Error('DREAM_STORAGE_GH_TOKEN не настроен в env')

  // PUT /repos/{owner}/{repo}/contents/{path}
  // body: { message, content (base64), branch }
  const r = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: content.toString('base64'),
      branch: 'main',
    }),
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`GitHub upload failed (${r.status}): ${err.slice(0, 200)}`)
  }
  return { url: RAW_BASE + path, path }
}

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
      // ЗАКОН: тяжёлые в GitHub, не Supabase. Лимит 20 MB.
      if (file.size > 20_971_520) {
        return NextResponse.json({ error: 'Файл больше 20 MB. Уменьши перед отправкой.' }, { status: 413 })
      }
      const ext = (file.type === 'image/png' ? 'png'
                : file.type === 'image/webp' ? 'webp'
                : file.type === 'image/heic' ? 'heic'
                : file.type === 'image/gif'  ? 'gif'
                : 'jpg')
      const ghPath = `${slug}/comments/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      try {
        const up = await uploadToGitHub(ghPath, buf, `${slug}: comment attachment`)
        attachment_path = up.path
        attachment_url = up.url
        attachment_bytes = file.size
      } catch (e: any) {
        return NextResponse.json({ error: `Не удалось залить в GitHub: ${e.message}` }, { status: 500 })
      }
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

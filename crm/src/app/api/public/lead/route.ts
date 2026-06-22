/**
 * POST /api/public/lead — публичный приём заявок с лендингов nimbolabs.io.
 *
 * Без x-agent-token: фронт публичный. Защита — CORS allowlist + honeypot + rate limit.
 *
 * Body:
 *   { slug, name, contact, task?, brand?, package?,
 *     utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, lid?,
 *     page?, website? (honeypot) }
 *
 * Поведение:
 *   - Honeypot заполнен → 200 тихо (в БД ничего).
 *   - Origin не в ALLOWED → 403.
 *   - Rate limit (10/60с/IP) → 429.
 *   - Невалидный contact (не phone/не email) → 400.
 *   - Дубликат за 24ч (тот же source + phone/email) → INSERT в dream_lead_comments.
 *   - Новая заявка → INSERT dream_leads + dream_activities (+ опц. TG-уведомление).
 *
 * См. ТЗ: crm/QUEUE/INBOX/TZ_nimbo_form_backend.md (v2).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

const VALID_SLUGS = new Set([
  'hub',
  'bots_sales', 'bots_booking', 'bots_ai',
  'sites_corporate', 'sites_landing',
  'seo_promotion', 'seo_top',
  'reputation',
])

const NICHE_BY_SLUG: Record<string, string> = {
  hub:             'универсальный',
  bots_sales:      'бот',
  bots_booking:    'бот',
  bots_ai:         'бот',
  sites_corporate: 'сайт',
  sites_landing:   'сайт',
  seo_promotion:   'seo',
  seo_top:         'seo',
  reputation:      'репутация',
}

const PHONE_RE = /^\+?[1-9]\d{10,14}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// In-memory rate limit (per Node instance). Перезапуск процесса = сброс.
const rateBucket = new Map<string, number[]>()
function rateLimited(ip: string): { limited: boolean; retryAfter: number } {
  const now = Date.now()
  const window = 60_000
  const max = 10
  const arr = (rateBucket.get(ip) ?? []).filter(t => now - t < window)
  arr.push(now)
  rateBucket.set(ip, arr)
  if (arr.length > max) {
    return { limited: true, retryAfter: Math.ceil((window - (now - arr[0])) / 1000) }
  }
  return { limited: false, retryAfter: 0 }
}

function getAllowedOrigins(): string[] {
  return (process.env.NIMBO_FORM_ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins()
  const ok = origin && allowed.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function detectContact(s: string): { phone?: string; email?: string } {
  const trimmed = s.trim()
  if (EMAIL_RE.test(trimmed)) return { email: trimmed.toLowerCase() }
  const digits = trimmed.replace(/[\s\-()]/g, '')
  if (PHONE_RE.test(digits)) {
    let p = digits.startsWith('+') ? digits : '+' + digits
    // 8XXXXXXXXXX → +7XXXXXXXXXX (РФ)
    if (p.startsWith('+8') && p.length === 12) p = '+7' + p.slice(2)
    return { phone: p }
  }
  return {}
}

function leadSlugFromContact(name: string, contact: { phone?: string; email?: string }): string {
  // Slug лида в `dream_leads.slug`: nimbo_<6 chars hash> чтобы не конфликтовать
  // с парсерскими slug-ами бизнесов. Берём hash от contact + timestamp.
  const base = (contact.phone || contact.email || name || 'lead')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(-8) || 'lead'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `nimbo_${base}_${suffix}`.slice(0, 60)
}

async function notifyTelegram(text: string) {
  const token = process.env.NIMBO_TG_TOKEN
  const chat  = process.env.NIMBO_TG_CHAT
  if (!token || !chat) {
    console.log('[public/lead] NIMBO_TG_* env not set, skipping notify')
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        text,
      }),
    })
  } catch (e) {
    console.error('[public/lead] TG notify failed:', e)
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)
  if (!headers['Access-Control-Allow-Origin']) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)

  // 1. CORS check (Origin обязан быть в allowlist).
  if (!cors['Access-Control-Allow-Origin']) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 2. Body parse.
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: cors })
  }

  // 3. Honeypot — заполнен значит бот. Возвращаем 200, ничего не пишем.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200, headers: cors })
  }

  // 4. Валидация.
  const slug: string = String(body.slug || '').trim()
  if (!VALID_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'validation', field: 'slug' }, { status: 400, headers: cors })
  }
  const name: string = String(body.name || '').trim()
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: 'validation', field: 'name' }, { status: 400, headers: cors })
  }
  const contactRaw: string = String(body.contact || '').trim()
  const contact = detectContact(contactRaw)
  if (!contact.phone && !contact.email) {
    return NextResponse.json({ error: 'validation', field: 'contact' }, { status: 400, headers: cors })
  }

  // 5. Rate limit (per IP).
  const ip = (req.headers.get('cf-connecting-ip')
           || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
           || 'unknown')
  const rl = rateLimited(ip)
  if (rl.limited) {
    return NextResponse.json(
      { error: 'rate_limit', retry_after: rl.retryAfter },
      { status: 429, headers: { ...cors, 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const source = `lp_${slug}`
  const utm = {
    utm_source:   String(body.utm_source || '').slice(0, 256) || null,
    utm_medium:   String(body.utm_medium || '').slice(0, 256) || null,
    utm_campaign: String(body.utm_campaign || '').slice(0, 256) || null,
    utm_content:  String(body.utm_content || '').slice(0, 256) || null,
    utm_term:     String(body.utm_term || '').slice(0, 256) || null,
    lid:          String(body.lid || '').slice(0, 128) || null,
  }
  const notes = {
    task:    String(body.task || '').slice(0, 1000) || null,
    brand:   String(body.brand || '').slice(0, 200) || null,
    package: String(body.package || '').slice(0, 200) || null,
    page:    String(body.page || '').slice(0, 500) || null,
    ...utm,
  }

  const sb = adminClient()

  // 6. Идемпотентность: ищем недавний лид с тем же source + phone/email.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let dup: any = null
  {
    let q = sb.from('dream_leads').select('id, slug')
      .eq('tenant_id', DREAM_TENANT_ID)
      .eq('source', source)
      .gte('created_at', since)
      .limit(1)
    if (contact.phone)      q = q.eq('phone', contact.phone)
    else if (contact.email) q = q.eq('email', contact.email)
    const { data } = await q
    dup = data && data[0] ? data[0] : null
  }

  if (dup) {
    // Дубликат — INSERT в dream_lead_comments.
    await sb.from('dream_lead_comments').insert({
      lead_id: dup.id,
      tenant_id: DREAM_TENANT_ID,
      kind: 'note',
      text: `Повторная заявка с формы (${slug}). Имя: ${name}. Контакт: ${contactRaw}.`,
      author: 'nimbo_lp',
    })
    return NextResponse.json(
      { ok: true, lead_id: dup.id, action: 'comment_added' },
      { status: 200, headers: cors }
    )
  }

  // 7. INSERT нового лида.
  // sales_stage/build_status НЕ задаём — пусть Сергей в UI выставит как со всеми
  // лидами из формы; БД ставит default (no_answer/parsed) — а мы не рискуем
  // словить CHECK violation на ещё не существующих значениях.
  const leadSlug = leadSlugFromContact(name, contact)
  const { data: inserted, error: insErr } = await sb.from('dream_leads').insert({
    tenant_id:    DREAM_TENANT_ID,
    slug:         leadSlug,
    name,
    phone:        contact.phone ?? null,
    email:        contact.email ?? null,
    niche:        NICHE_BY_SLUG[slug] ?? null,
    source,
    notes,
  }).select('id, slug').single()

  if (insErr || !inserted) {
    console.error('[public/lead] insert dream_leads failed:', insErr)
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: cors })
  }

  // 8. dream_activities — для timeline. Тип 'note' (валидный); семантика — в meta.kind.
  await sb.from('dream_activities').insert({
    lead_id:   inserted.id,
    tenant_id: DREAM_TENANT_ID,
    type:      'note',
    actor:     'nimbo_lp',
    title:     `📝 Заявка с лендинга ${slug}`,
    meta:      { kind: 'form_submit', slug, page: notes.page, ...utm },
  })

  // 9. TG-уведомление (если env заполнены).
  const tgText =
    `🟢 <b>Заявка nimbolabs.io · ${slug}</b>\n` +
    `👤 ${name}\n` +
    `📞 ${contactRaw}\n` +
    (notes.task ? `📝 ${notes.task}\n` : '') +
    (utm.utm_source ? `🌐 utm: ${utm.utm_source}/${utm.utm_medium || '-'}/${utm.utm_campaign || '-'}\n` : '') +
    `🔗 <a href="https://metallportal-crm2.vercel.app/dream/leads/${inserted.slug}">Открыть в CRM</a>`
  // fire-and-forget
  notifyTelegram(tgText)

  return NextResponse.json(
    { ok: true, lead_id: inserted.id, lead_slug: inserted.slug, action: 'created' },
    { status: 200, headers: cors }
  )
}

/**
 * TASK_025 — Beacon-endpoint для трекинга поведения на сайте.
 *
 * POST /t
 *   Body (JSON): { token, type, duration_sec?, scroll_pct?, referrer?, meta? }
 *   type: 'pageview' | 'heartbeat' | 'scroll' | 'phone_click' | 'cta_click' | 'form_submit'
 *
 * Маячок на лендинге шлёт через navigator.sendBeacon.
 * Лог идёт в dream_link_events, агрегаты обновляются триггером.
 *
 * CORS открыт (Access-Control-Allow-Origin: *) — beacon отправляется с
 * клиентского сайта на нашем investfreelife.github.io или собственный домен.
 *
 * Edge runtime — минимальная задержка (≤100ms).
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const TENANT_ID = '11111111-2222-3333-4444-555555555555'
const VALID_TYPES = ['pageview', 'heartbeat', 'scroll', 'phone_click', 'cta_click', 'form_submit']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return new NextResponse(null, { status: 400, headers: CORS }) }

  const { token, type } = body
  if (!token || !VALID_TYPES.includes(type)) {
    return new NextResponse(null, { status: 400, headers: CORS })
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Резолв lead_id (минимальный GET)
  let leadId: number | null = null
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/dream_leads?select=id&track_token=eq.${encodeURIComponent(token)}&limit=1`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    )
    if (r.ok) {
      const arr = await r.json() as Array<{ id: number }>
      if (arr.length > 0) leadId = arr[0].id
    }
  } catch {}

  // Не блокируем ответ записью — fire-and-forget
  fetch(`${SUPA_URL}/rest/v1/dream_link_events`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      lead_id: leadId,
      token,
      type,
      duration_sec: body.duration_sec ?? null,
      scroll_pct: body.scroll_pct ?? null,
      referrer: body.referrer ?? req.headers.get('referer') ?? null,
      ua: req.headers.get('user-agent') ?? null,
      ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? null,
      meta: body.meta ?? {},
    }),
  }).catch(() => {})

  return new NextResponse(null, { status: 204, headers: CORS })
}

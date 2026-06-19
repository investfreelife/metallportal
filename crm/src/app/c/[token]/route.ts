/**
 * TASK_025 — Трекер кликов (вместо Cloudflare Worker, на CRM-edge).
 *
 * GET /c/<token>
 *   1. Резолвим лид по track_token → dream_leads
 *   2. Лог события click в dream_link_events (с ip/ua/referrer)
 *   3. 302 на landing_public_url с UTM (?utm_source=ai_call&lid=<token>)
 *   4. Set-Cookie lid=<token> чтобы beacon на сайте знал свой токен
 *
 * Триггер `dream_link_events_aggregate` сразу UPDATE-ит dream_leads:
 *   visits_count++, first_visit_at/last_visit_at, time/scroll агрегаты.
 *
 * Доктрина: ничего тяжёлого тут не делаем — лог идёт fire-and-forget,
 * редирект отдаём моментально. Worker не нужен — Vercel edge ≤100ms.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const TENANT_ID = '11111111-2222-3333-4444-555555555555'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return new NextResponse('Bad request', { status: 400 })

  // Supabase REST через fetch (edge-compatible, supabase-js не нужен)
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Резолв лида: один GET /rest/v1/dream_leads?track_token=eq.<token>
  const r = await fetch(
    `${SUPA_URL}/rest/v1/dream_leads?select=id,slug,landing_public_url,landing_deployed_url&track_token=eq.${encodeURIComponent(token)}&limit=1`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  )
  if (!r.ok) return new NextResponse('Lookup error', { status: 502 })
  const arr = await r.json() as Array<{ id: number; landing_public_url: string | null; landing_deployed_url: string | null }>
  if (arr.length === 0) return new NextResponse('Not found', { status: 404 })

  const lead = arr[0]
  const landingUrl = lead.landing_deployed_url ?? lead.landing_public_url
  if (!landingUrl) return new NextResponse('No landing for this lead', { status: 404 })

  // Лог события (fire-and-forget — не ждём, чтобы редирект был быстрым)
  const headers = req.headers
  const event = {
    tenant_id: TENANT_ID,
    lead_id: lead.id,
    token,
    type: 'click',
    ip: headers.get('cf-connecting-ip') ?? headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0] ?? null,
    ua: headers.get('user-agent') ?? null,
    referrer: headers.get('referer') ?? null,
  }
  // не await — пусть стрельнёт фоном
  fetch(`${SUPA_URL}/rest/v1/dream_link_events`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(event),
  }).catch(() => {})

  // 302 на лендинг + UTM
  const redirect = new URL(landingUrl)
  redirect.searchParams.set('utm_source', 'ai_call')
  redirect.searchParams.set('lid', token)

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: redirect.toString(),
      'Set-Cookie': `lid=${token}; Path=/; Max-Age=2592000; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  })
}

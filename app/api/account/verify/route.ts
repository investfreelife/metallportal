import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { accountVerifyRatelimit, getClientIp } from '@/lib/ratelimit'

/**
 * POST /api/account/verify  (TASK_052 hardening, audit 2026-06-18 SEV-1)
 *
 * Раньше: 6-значный OTP без rate-limit/счётчика попыток → брутфорс ≤10 мин
 * (1e6 комбинаций ÷ скорость HTTP = захват кабинета). Теперь:
 *   - sliding-window 5 попыток / 15 мин per-IP И per-phone (distrib + targeted)
 *   - 429 после превышения, с Retry-After
 *   - на неверном OTP — generic "Неверный код" (без раскрытия что именно)
 *   - OTP всё ещё генерится через `crypto.randomInt` в /login (зафиксено отдельно)
 */
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { phone, otp } = await req.json()
  if (!phone || !otp) return NextResponse.json({ error: 'phone and otp required' }, { status: 400 })

  const digits = String(phone).replace(/\D/g, '')
  const normalized = digits.length === 11 ? '+' + digits
    : digits.length === 10 ? '+7' + digits
    : '+' + digits

  // SEV-1: rate-limit per-IP И per-phone — нужно ОБА превысить, чтобы не получить хвост.
  const ip = getClientIp(req)
  const ipLimit = await accountVerifyRatelimit.limit(`ip:${ip}`)
  const phoneLimit = await accountVerifyRatelimit.limit(`phone:${normalized}`)
  const blocked = !ipLimit.success || !phoneLimit.success
  if (blocked) {
    const reset = Math.max(ipLimit.reset, phoneLimit.reset)
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте через несколько минут.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  const supabase = getSupabase()

  const { data: contact } = await supabase.from('contacts')
    .select('id, full_name, phone, email, login_otp, login_otp_expires_at')
    .eq('tenant_id', TENANT_ID)
    .eq('phone', normalized)
    .maybeSingle()

  // Generic error: не раскрываем "Контакт не найден" vs "Неверный код"
  // (защита от phone-enumeration). 400 единый.
  if (!contact || contact.login_otp !== String(otp)) {
    return NextResponse.json({ error: 'Неверный код или истёк' }, { status: 400 })
  }
  if (!contact.login_otp_expires_at || new Date(contact.login_otp_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Код истёк. Запросите новый.' }, { status: 400 })
  }

  // Clear OTP
  await supabase.from('contacts').update({ login_otp: null, login_otp_expires_at: null }).eq('id', contact.id)

  // Create session
  const { data: session } = await supabase.from('contact_sessions').insert({
    contact_id: contact.id,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).select('token').single()

  if (!session?.token) return NextResponse.json({ error: 'Ошибка создания сессии' }, { status: 500 })

  // Set httpOnly cookie
  const cookieStore = await cookies()
  cookieStore.set('mp_session', session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return NextResponse.json({ ok: true, name: contact.full_name })
}

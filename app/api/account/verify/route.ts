import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const { phone, otp } = await req.json()
  if (!phone || !otp) return NextResponse.json({ error: 'phone and otp required' }, { status: 400 })

  const digits = String(phone).replace(/\D/g, '')
  const normalized = digits.length === 11 ? '+' + digits
    : digits.length === 10 ? '+7' + digits
    : '+' + digits

  const supabase = getSupabase()

  const { data: contact } = await supabase.from('contacts')
    .select('id, full_name, phone, email, login_otp, login_otp_expires_at')
    .eq('tenant_id', TENANT_ID)
    .eq('phone', normalized)
    .maybeSingle()

  if (!contact) return NextResponse.json({ error: 'Контакт не найден' }, { status: 404 })
  if (contact.login_otp !== String(otp)) return NextResponse.json({ error: 'Неверный код' }, { status: 400 })
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

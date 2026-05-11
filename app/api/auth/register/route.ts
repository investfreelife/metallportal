import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashPwd(pwd: string) {
  const salt = process.env.PASSWORD_SALT
  if (!salt) throw new Error('PASSWORD_SALT environment variable is required')
  return crypto.createHash('sha256').update(pwd + salt).digest('hex')
}

function genRefCode(name: string) {
  const base = (name || 'USER').replace(/[^a-zA-Zа-яёА-ЯЁ]/gi, '').toUpperCase().substring(0, 4) || 'USER'
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${base}${suffix}`
}

export async function POST(req: NextRequest) {
  const { email, password, full_name, company_name, phone, ref_code } = await req.json()

  if (!email || !password) return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Пароль минимум 6 символов' }, { status: 400 })

  const { data: existing } = await supabase.from('site_users').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 400 })

  // ТЗ #049: ref_code may come from body OR from cookie (mp_ref set by landing on ?ref=XXX)
  let effectiveRefCode = (ref_code || '').toString().toUpperCase().trim()
  if (!effectiveRefCode) {
    const cookieRef = req.cookies.get('mp_ref')?.value
    if (cookieRef) effectiveRefCode = cookieRef.toUpperCase().trim()
  }

  let referred_by: string | null = null
  let referral_card = false
  if (effectiveRefCode) {
    const { data: referrer } = await supabase.from('site_users').select('id').eq('ref_code', effectiveRefCode).single()
    if (referrer) {
      referred_by = referrer.id
      referral_card = true  // 1% lifetime discount card per Sergey
    }
  }

  const { data: user, error } = await supabase.from('site_users').insert({
    email, password_hash: hashPwd(password), full_name, company_name, phone,
    ref_code: genRefCode(full_name || email),
    referred_by,
    referral_card,
    referred_at: referred_by ? new Date().toISOString() : null,
  } as any).select('id, email, ref_code, referral_card').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await supabase.from('contacts').insert({
      tenant_id: 'a1000000-0000-0000-0000-000000000001',
      full_name, company_name, email, phone,
      source: ref_code ? 'referral' : 'site', ai_score: 30,
    })
  } catch {}

  const res = NextResponse.json({ success: true, user })
  res.cookies.set('user_session', user.id, { httpOnly: true, secure: true, maxAge: 30 * 24 * 3600, path: '/' })
  // Clear mp_ref cookie after consumption (single-use)
  if (effectiveRefCode) {
    res.cookies.set('mp_ref', '', { maxAge: 0, path: '/' })
  }
  return res
}

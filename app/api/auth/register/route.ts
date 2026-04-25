import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashPwd(pwd: string) {
  return crypto.createHash('sha256').update(pwd + (process.env.PASSWORD_SALT || 'harlan_salt_2024')).digest('hex')
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

  let referred_by = null
  if (ref_code) {
    const { data: referrer } = await supabase.from('site_users').select('id').eq('ref_code', ref_code).single()
    if (referrer) referred_by = referrer.id
  }

  const { data: user, error } = await supabase.from('site_users').insert({
    email, password_hash: hashPwd(password), full_name, company_name, phone,
    ref_code: genRefCode(full_name || email), referred_by,
  }).select('id, email, ref_code').single()

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
  return res
}

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

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })

  const { data: user } = await supabase
    .from('site_users')
    .select('id, email, full_name, ref_code')
    .eq('email', email)
    .eq('password_hash', hashPwd(password))
    .single()

  if (!user) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })

  await supabase.from('site_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)

  const res = NextResponse.json({ success: true, user })
  res.cookies.set('user_session', user.id, { httpOnly: true, secure: true, maxAge: 30 * 24 * 3600, path: '/' })
  return res
}

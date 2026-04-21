import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { login, password } = await request.json()

  if (!login || !password) {
    return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('admin_users')
    .select('name, login, role, is_active')
    .eq('login', login.trim().toLowerCase())
    .eq('password', password)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  const session = {
    login: data.login,
    name: data.name,
    role: data.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }

  const response = NextResponse.json({ ok: true, name: data.name })
  response.cookies.set('crm_session', Buffer.from(JSON.stringify(session)).toString('base64'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return response
}

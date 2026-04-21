import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, name, login, role, is_active, status, telegram_username, telegram_chat_id, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const { name, login, password, role = 'manager', telegram_username } = await req.json()

  if (!name || !login || !password) {
    return NextResponse.json({ error: 'Нужны имя, логин и пароль' }, { status: 400 })
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('login', login.trim().toLowerCase())
    .single()

  if (existing) return NextResponse.json({ error: 'Логин уже занят' }, { status: 400 })

  const { data, error } = await supabase.from('admin_users').insert({
    name: name.trim(),
    login: login.trim().toLowerCase(),
    password: password.trim(),
    role,
    is_active: true,
    status: 'active',
    telegram_username: telegram_username?.replace('@', '') || null,
  }).select('id, name, login, role').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, user: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['role', 'is_active', 'status', 'telegram_username', 'telegram_chat_id']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) {
    if (updates[k] !== undefined) patch[k] = updates[k]
  }

  const { error } = await supabase.from('admin_users').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// TEMPORARY debug endpoint — Sergey directive 2026-06-18.
// Login route отвечает 401 несмотря на корректный пароль. Нужно увидеть
// что именно возвращает SELECT из admin_users на production.
//
// !! УДАЛИТЬ после диагностики !!

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(crypto.scrypt)

export const dynamic = 'force-dynamic'

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith('scrypt:')) {
    const [, salt, hex] = stored.split(':')
    const hash = (await scryptAsync(plain, salt, 64)) as Buffer
    const stored64 = Buffer.from(hex, 'hex')
    if (hash.length !== stored64.length) return false
    return crypto.timingSafeEqual(hash, stored64)
  }
  if (plain.length !== stored.length) return false
  return crypto.timingSafeEqual(Buffer.from(plain), Buffer.from(stored))
}

export async function POST(req: NextRequest) {
  // Минимальная защита — секрет токен
  if (req.headers.get('x-debug-token') !== 'debug-2026-06-18-sergey-stolica') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { login, password } = await req.json().catch(() => ({}))

  const env_url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const env_key_present = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const env_key_prefix = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 20)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, tenant_id, name, login, role, is_active, is_superadmin, password, tenants(name, industry)')
    .eq('login', login.trim().toLowerCase())
    .eq('is_active', true)
    .single()

  const ok = data?.password ? await verifyPassword(password, data.password) : false

  return NextResponse.json({
    env_url,
    env_key_present,
    env_key_prefix,
    select_error: error?.message ?? null,
    select_error_code: error?.code ?? null,
    found: !!data,
    login: data?.login ?? null,
    is_active: data?.is_active ?? null,
    is_superadmin: data?.is_superadmin ?? null,
    tenant_id: data?.tenant_id ?? null,
    tenants_value: data?.tenants ?? null,
    tenants_is_array: Array.isArray(data?.tenants),
    password_starts_with: data?.password?.slice(0, 10) ?? null,
    password_length: data?.password?.length ?? null,
    password_matches_input_length: data?.password?.length === password?.length,
    verify_result: ok,
    node_version: process.version,
  })
}

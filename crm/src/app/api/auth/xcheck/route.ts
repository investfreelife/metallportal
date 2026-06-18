// TEMP debug — Sergey 2026-06-18 stuck on login despite plain password.
// Reports exactly what login route sees on production.

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
  if (req.headers.get('x-debug-token') !== 'check-2026-06-18') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const { login, password } = await req.json().catch(() => ({}))

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
    env_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    env_key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 25),
    select_error: error?.message ?? null,
    found: !!data,
    is_active: data?.is_active,
    is_superadmin: data?.is_superadmin,
    pwd_in_db_prefix: data?.password?.slice(0, 12) ?? null,
    pwd_in_db_len: data?.password?.length ?? null,
    pwd_input_len: password?.length ?? null,
    pwd_starts_scrypt: data?.password?.startsWith('scrypt:') ?? null,
    verify: ok,
    node: process.version,
  })
}

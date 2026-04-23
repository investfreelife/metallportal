import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { promisify } from 'util'
import { signSession } from '@/lib/session'

const scryptAsync = promisify(crypto.scrypt)

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// ── Simple in-memory rate limiter (resets on cold start) ──────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= MAX_ATTEMPTS) return false
  entry.count++
  return true
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip)
}

// ── Password helpers ───────────────────────────────────────────────
async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = (await scryptAsync(plain, salt, 64)) as Buffer
  return `scrypt:${salt}:${hash.toString('hex')}`
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith('scrypt:')) {
    const [, salt, hex] = stored.split(':')
    const hash = (await scryptAsync(plain, salt, 64)) as Buffer
    const stored64 = Buffer.from(hex, 'hex')
    if (hash.length !== stored64.length) return false
    return crypto.timingSafeEqual(hash, stored64)
  }
  // Legacy plain-text (timing-safe comparison to prevent oracle attacks)
  if (plain.length !== stored.length) return false
  return crypto.timingSafeEqual(Buffer.from(plain), Buffer.from(stored))
}

// ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Подождите 15 минут.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { login, password } = body

  if (!login || !password) {
    return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch user by login only (never filter by password in SQL)
  const { data } = await supabase
    .from('admin_users')
    .select('id, name, login, role, is_active, password')
    .eq('tenant_id', TENANT_ID)
    .eq('login', login.trim().toLowerCase())
    .eq('is_active', true)
    .single()

  const FAKE_HASH = 'scrypt:0000000000000000:' + '00'.repeat(64) // dummy for timing
  const stored = data?.password || FAKE_HASH

  const ok = await verifyPassword(password, stored)

  if (!data || !ok) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  // Auto-upgrade plain-text password to scrypt hash on successful login
  if (data && ok && !data.password.startsWith('scrypt:')) {
    const hashed = await hashPassword(password)
    await supabase.from('admin_users').update({ password: hashed }).eq('id', data.id)
  }

  clearRateLimit(ip)

  const sessionData = {
    login: data.login,
    name: data.name,
    role: data.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }

  const token = signSession(sessionData)

  const response = NextResponse.json({ ok: true, name: data.name })
  response.cookies.set('crm_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return response
}

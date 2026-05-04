import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * PUBLIC BY DESIGN: invited team-member self-onboarding.
 * The single-use `invite_token` is the credential; rate-limited per IP to
 * mitigate token-guessing attacks. (Tokens are 16 random uppercase chars
 * = ~80 bits of entropy — brute-force not feasible at 30 req/min.)
 *
 * NOTE: previously gated by `requireAdmin`, which broke the activation
 * flow (invitee has no session yet). c001 corrects this.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** GET /api/team/join?token=XXX — validate token, return user info */
export async function GET(req: NextRequest) {
  if (!checkRateLimit(req, 'team-join-get', 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('admin_users')
    .select('id, name, login, status, invite_expires_at')
    .eq('invite_token', token)
    .single()

  if (!data) return NextResponse.json({ error: 'Ссылка недействительна' }, { status: 404 })
  if (data.status !== 'invited') return NextResponse.json({ error: 'Аккаунт уже активирован' }, { status: 400 })
  if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Срок действия ссылки истёк' }, { status: 400 })
  }

  return NextResponse.json({ name: data.name, login: data.login })
}

/** POST /api/team/join — set new password, activate account */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(req, 'team-join-post', 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'token + password required' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Пароль слишком короткий' }, { status: 400 })

  const supabase = getSupabase()

  const { data } = await supabase
    .from('admin_users')
    .select('id, status, invite_expires_at')
    .eq('invite_token', token)
    .single()

  if (!data) return NextResponse.json({ error: 'Ссылка недействительна' }, { status: 404 })
  if (data.status !== 'invited') return NextResponse.json({ error: 'Аккаунт уже активирован' }, { status: 400 })
  if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Срок действия ссылки истёк' }, { status: 400 })
  }

  const { error } = await supabase.from('admin_users').update({
    password,
    status: 'active',
    invite_token: null,
    invite_expires_at: null,
  }).eq('id', data.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

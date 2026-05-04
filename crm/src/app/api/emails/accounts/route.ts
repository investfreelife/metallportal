import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const PROVIDER_PRESETS: Record<string, { smtp_host: string; smtp_port: number; imap_host: string; imap_port: number; smtp_secure: boolean; imap_tls: boolean }> = {
  gmail:  { smtp_host: 'smtp.gmail.com',   smtp_port: 587, smtp_secure: false, imap_host: 'imap.gmail.com',   imap_port: 993, imap_tls: true },
  mailru: { smtp_host: 'smtp.mail.ru',     smtp_port: 587, smtp_secure: false, imap_host: 'imap.mail.ru',     imap_port: 993, imap_tls: true },
  yandex: { smtp_host: 'smtp.yandex.ru',   smtp_port: 587, smtp_secure: false, imap_host: 'imap.yandex.ru',   imap_port: 993, imap_tls: true },
  custom: { smtp_host: '',                 smtp_port: 587, smtp_secure: false, imap_host: '',                 imap_port: 993, imap_tls: true },
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'manager', 'admin'])
  if (!auth.ok) return auth.error

  const supabase = getSupabase()
  const { data, error } = await supabase.from('email_accounts')
    .select('id, email, display_name, provider, status, last_synced_at, last_error, is_default, smtp_host, imap_host')
    .eq('tenant_id', TENANT_ID)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'manager', 'admin'])
  if (!auth.ok) return auth.error

  const body = await req.json()
  const { email, display_name, provider = 'custom', smtp_pass, imap_pass, smtp_host, imap_host, smtp_port, imap_port } = body

  if (!email || !smtp_pass) return NextResponse.json({ error: 'email и smtp_pass обязательны' }, { status: 400 })

  const preset = PROVIDER_PRESETS[provider] ?? PROVIDER_PRESETS.custom
  const supabase = getSupabase()

  const { data, error } = await supabase.from('email_accounts').insert({
    tenant_id: TENANT_ID,
    email,
    display_name: display_name || email,
    provider,
    smtp_host: smtp_host || preset.smtp_host,
    smtp_port: smtp_port || preset.smtp_port,
    smtp_secure: preset.smtp_secure,
    smtp_user: email,
    smtp_pass,
    imap_host: imap_host || preset.imap_host,
    imap_port: imap_port || preset.imap_port,
    imap_tls: preset.imap_tls,
    imap_user: email,
    imap_pass: imap_pass || smtp_pass,
    status: 'active',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}

export async function DELETE(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'manager', 'admin'])
  if (!auth.ok) return auth.error

  const { id } = await req.json()
  const supabase = getSupabase()
  const { error } = await supabase.from('email_accounts').delete().eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

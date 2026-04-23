import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { account_id, test_send = false } = await req.json().catch(() => ({}))
  if (!account_id) return NextResponse.json({ error: 'account_id обязателен' }, { status: 400 })

  const supabase = getSupabase()
  const { data: acc } = await supabase.from('email_accounts')
    .select('*').eq('id', account_id).eq('tenant_id', TENANT_ID).single()

  if (!acc) return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 })

  const result: {
    imap: 'ok' | 'error' | 'skipped'
    imap_count?: number
    imap_error?: string
    smtp: 'ok' | 'error' | 'skipped'
    smtp_error?: string
  } = { imap: 'skipped', smtp: 'skipped' }

  // ── Test IMAP ──────────────────────────────────────────────
  if (acc.imap_host) {
    const client = new ImapFlow({
      host: acc.imap_host,
      port: acc.imap_port ?? 993,
      secure: acc.imap_tls ?? true,
      auth: { user: acc.imap_user || acc.email, pass: acc.imap_pass },
      logger: false,
      tls: { rejectUnauthorized: false },
    })
    try {
      await client.connect()
      const mb = await client.mailboxOpen('INBOX', { readOnly: true })
      result.imap = 'ok'
      result.imap_count = mb.exists
      await client.logout()

      // Update DB status
      await supabase.from('email_accounts').update({
        status: 'active', last_synced_at: new Date().toISOString(), last_error: null,
      }).eq('id', account_id)
    } catch (e: unknown) {
      result.imap = 'error'
      result.imap_error = (e as Error).message
      await supabase.from('email_accounts').update({
        status: 'error', last_error: (e as Error).message,
      }).eq('id', account_id)
    }
  }

  // ── Test SMTP (optional — send test email) ─────────────────
  if (test_send && acc.smtp_host) {
    const transport = nodemailer.createTransport({
      host: acc.smtp_host,
      port: acc.smtp_port ?? 587,
      secure: acc.smtp_secure ?? false,
      auth: { user: acc.smtp_user || acc.email, pass: acc.smtp_pass },
      tls: { rejectUnauthorized: false },
    })
    try {
      await transport.sendMail({
        from: `"${acc.display_name || 'CRM'}" <${acc.email}>`,
        to: acc.email,
        subject: '✅ Тест CRM — почта работает',
        text: `Это тестовое письмо от CRM МеталлПортал.\nВремя: ${new Date().toLocaleString('ru')}\nЕсли вы его получили — SMTP работает корректно.`,
      })
      result.smtp = 'ok'
    } catch (e: unknown) {
      result.smtp = 'error'
      result.smtp_error = (e as Error).message
    }
  }

  return NextResponse.json(result)
}

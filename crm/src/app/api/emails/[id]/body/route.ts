import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/apiAuth'
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireSession(_req)
  if (!auth.ok) return auth.error

  const { id } = await params
  const supabase = getSupabase()

  // Load email + account
  const { data: email } = await supabase.from('emails')
    .select('id, imap_uid, imap_folder, body_text, body_html, account_id')
    .eq('id', id).eq('tenant_id', TENANT_ID).single()

  if (!email) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  // If already loaded — return immediately
  if (email.body_text || email.body_html) {
    return NextResponse.json({ body_text: email.body_text, body_html: email.body_html })
  }

  if (!email.imap_uid || !email.account_id) {
    return NextResponse.json({ body_text: '(нет данных для загрузки)', body_html: null })
  }

  const { data: acc } = await supabase.from('email_accounts')
    .select('imap_host, imap_port, imap_tls, imap_user, imap_pass, email')
    .eq('id', email.account_id).single()

  if (!acc?.imap_host) return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 })

  const client = new ImapFlow({
    host: acc.imap_host,
    port: acc.imap_port ?? 993,
    secure: acc.imap_tls ?? true,
    auth: { user: acc.imap_user || acc.email, pass: acc.imap_pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  })

  let bodyText = ''
  let bodyHtml = ''

  try {
    await client.connect()
    await client.mailboxOpen(email.imap_folder || 'INBOX', { readOnly: true })

    // Fetch raw source by UID and parse with mailparser
    for await (const msg of client.fetch(String(email.imap_uid), { source: true }, { uid: true })) {
      if (msg.source) {
        try {
          const mail = await simpleParser(msg.source)
          bodyText = mail.text ?? ''
          bodyHtml = mail.html || mail.textAsHtml || ''
        } catch {
          bodyText = msg.source.toString().slice(0, 5000)
        }
      }
    }
  } finally {
    await client.logout().catch(() => {})
  }

  // Cache in DB
  await supabase.from('emails').update({ body_text: bodyText || null, body_html: bodyHtml || null })
    .eq('id', id)

  return NextResponse.json({ body_text: bodyText || null, body_html: bodyHtml || null })
}

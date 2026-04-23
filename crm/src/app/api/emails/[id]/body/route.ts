import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Fetch raw source by UID then extract body parts
    for await (const msg of client.fetch(String(email.imap_uid), {
      bodyParts: ['TEXT', 'HTML', '1', '1.1', '1.2'],
    }, { uid: true })) {
      // Try each part in preference order
      const html = msg.bodyParts?.get('HTML') ?? msg.bodyParts?.get('html') ?? msg.bodyParts?.get('1.2')
      const text = msg.bodyParts?.get('TEXT') ?? msg.bodyParts?.get('text') ?? msg.bodyParts?.get('1.1') ?? msg.bodyParts?.get('1')
      bodyHtml = html ? Buffer.from(html as Buffer).toString('utf8') : ''
      bodyText = text ? Buffer.from(text as Buffer).toString('utf8') : ''
      // Fallback: if nothing found, fetch full source and extract plain text
      if (!bodyText && !bodyHtml) {
        for await (const src of client.fetch(String(email.imap_uid), { source: true }, { uid: true })) {
          const raw = src.source?.toString() ?? ''
          // Extract body after headers (double newline)
          const bodyStart = raw.indexOf('\r\n\r\n')
          bodyText = bodyStart > -1 ? raw.slice(bodyStart + 4, bodyStart + 4004) : raw.slice(0, 4000)
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

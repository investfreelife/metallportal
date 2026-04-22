import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { account_id, to, cc, subject, body_html, body_text, deal_id, contact_id, in_reply_to, thread_id } = await req.json()

  if (!account_id || !to || !subject) {
    return NextResponse.json({ error: 'account_id, to, subject required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Load account credentials
  const { data: account, error: accErr } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', account_id)
    .eq('tenant_id', TENANT_ID)
    .single()

  if (accErr || !account) return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 })
  if (!account.smtp_host || !account.smtp_pass) return NextResponse.json({ error: 'SMTP не настроен' }, { status: 400 })

  // Build transport
  const transport = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port ?? 587,
    secure: account.smtp_secure ?? false,
    auth: { user: account.smtp_user || account.email, pass: account.smtp_pass },
    tls: { rejectUnauthorized: false },
  })

  // Generate message ID
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@metallportal.crm>`

  const toList = Array.isArray(to) ? to : [to]
  const ccList = Array.isArray(cc) ? cc : (cc ? [cc] : [])

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${account.display_name || 'МеталлПортал'}" <${account.email}>`,
    to: toList.join(', '),
    cc: ccList.length ? ccList.join(', ') : undefined,
    subject,
    html: body_html ?? body_text,
    text: body_text ?? body_html?.replace(/<[^>]+>/g, '') ?? '',
    messageId: msgId,
    inReplyTo: in_reply_to ?? undefined,
    references: in_reply_to ? [in_reply_to] : undefined,
  }

  try {
    await transport.sendMail(mailOptions)
  } catch (e: unknown) {
    const msg = (e as Error).message
    await supabase.from('email_accounts').update({ last_error: msg, status: 'error' }).eq('id', account_id)
    return NextResponse.json({ error: 'SMTP ошибка: ' + msg }, { status: 500 })
  }

  // Save to DB
  const derivedThreadId = thread_id ?? in_reply_to ?? msgId

  const { data: saved } = await supabase.from('emails').insert({
    tenant_id: TENANT_ID,
    account_id,
    message_id: msgId,
    thread_id: derivedThreadId,
    in_reply_to: in_reply_to ?? null,
    direction: 'outbound',
    from_email: account.email,
    from_name: account.display_name,
    to_emails: toList.map((e: string) => ({ email: e })),
    cc_emails: ccList.map((e: string) => ({ email: e })),
    subject,
    body_html: body_html ?? null,
    body_text: body_text ?? null,
    deal_id: deal_id ?? null,
    contact_id: contact_id ?? null,
    sent_at: new Date().toISOString(),
    is_read: true,
  }).select('id').single()

  return NextResponse.json({ ok: true, id: saved?.id, message_id: msgId })
}

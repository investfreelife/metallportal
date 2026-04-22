import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { subject, body } = await req.json()
  if (!subject?.trim() || !body?.trim()) return NextResponse.json({ error: 'subject and body required' }, { status: 400 })

  const supabase = getSupabase()

  // Get contact email
  const { data: contact } = await supabase
    .from('contacts')
    .select('email, full_name, company_name')
    .eq('id', id)
    .single()

  if (!contact?.email) return NextResponse.json({ ok: false, message: 'У контакта не указан email' })

  // Get default email account (SMTP settings)
  const { data: account } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('tenant_id', 'a1000000-0000-0000-0000-000000000001')
    .eq('is_default', true)
    .eq('status', 'active')
    .single()

  if (!account?.smtp_host) {
    return NextResponse.json({ ok: false, message: 'SMTP не настроен. Добавьте почтовый аккаунт в Настройки → Email' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port ?? 587,
      secure: account.smtp_secure ?? false,
      auth: { user: account.smtp_user, pass: account.smtp_pass },
    })

    await transporter.sendMail({
      from: `"${account.display_name ?? 'МеталлПортал'}" <${account.email}>`,
      to: contact.email,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    })

    // Save to emails table
    await supabase.from('emails').insert({
      tenant_id: 'a1000000-0000-0000-0000-000000000001',
      account_id: account.id,
      contact_id: id,
      direction: 'outbound',
      from_email: account.email,
      from_name: account.display_name ?? 'МеталлПортал',
      to_emails: [{ email: contact.email, name: contact.full_name }],
      subject,
      body_text: body,
      is_read: true,
      sent_at: new Date().toISOString(),
    })

    // Log to activities
    await supabase.from('activities').insert({
      tenant_id: 'a1000000-0000-0000-0000-000000000001',
      contact_id: id,
      type: 'email',
      direction: 'outbound',
      subject,
      body,
    })

    return NextResponse.json({ ok: true, message: `Письмо отправлено на ${contact.email}` })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, message: `Ошибка SMTP: ${(e as Error).message}` })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { account_id } = await req.json().catch(() => ({}))
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from('email_accounts').select('*').eq('tenant_id', TENANT_ID).not('imap_host', 'is', null)
  // When specific account_id given (manual retry) — include regardless of status
  if (account_id) q = q.eq('id', account_id)
  else q = q.eq('status', 'active')

  const { data: accounts } = await q
  if (!accounts?.length) return NextResponse.json({ ok: true, synced: 0 })

  let totalSynced = 0

  for (const acc of accounts) {
    try {
      const synced = await syncAccount(acc, supabase)
      totalSynced += synced
      await supabase.from('email_accounts').update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
        status: 'active',
      }).eq('id', acc.id)
    } catch (e: unknown) {
      const msg = (e as Error).message
      console.error('[imap sync]', acc.email, msg)
      await supabase.from('email_accounts').update({ last_error: msg, status: 'error' }).eq('id', acc.id)
    }
  }

  return NextResponse.json({ ok: true, synced: totalSynced })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncAccount(acc: Record<string, unknown>, supabase: any): Promise<number> {
  const { data: lastEmail } = await supabase.from('emails')
    .select('imap_uid')
    .eq('account_id', acc.id as string)
    .eq('imap_folder', 'INBOX')
    .order('imap_uid', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastUid = (lastEmail?.imap_uid as number) ?? 0

  const client = new ImapFlow({
    host: acc.imap_host as string,
    port: (acc.imap_port as number) ?? 993,
    secure: (acc.imap_tls as boolean) ?? true,
    auth: { user: (acc.imap_user as string) || (acc.email as string), pass: acc.imap_pass as string },
    logger: false,
    tls: { rejectUnauthorized: false },
  })

  await client.connect()

  // ── Step 1: Collect all envelopes into memory (IMAP connection open for minimum time) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: Array<{ uid: number; envelope: any }> = []

  try {
    const mailbox = await client.mailboxOpen('INBOX', { readOnly: true })
    const total = mailbox.exists
    if (total === 0) {
      await client.logout()
      return 0
    }

    const uidRange = lastUid > 0 ? `${lastUid + 1}:*` : `${Math.max(1, total - 49)}:*`

    for await (const msg of client.fetch(uidRange, { uid: true, envelope: true }, { uid: lastUid > 0 })) {
      if (msg.envelope) messages.push({ uid: msg.uid, envelope: msg.envelope })
    }
  } finally {
    // Close IMAP immediately — before any DB calls
    await client.logout().catch(() => {})
  }

  // ── Step 2: Insert to DB (IMAP connection already closed) ──
  let synced = 0

  for (const { uid, envelope: env } of messages) {
    const msgId = env.messageId || null

    if (msgId) {
      const { data: exists } = await supabase.from('emails')
        .select('id').eq('message_id', msgId).maybeSingle()
      if (exists) continue
    } else {
      const { data: exists } = await supabase.from('emails')
        .select('id').eq('imap_uid', uid).eq('account_id', acc.id).maybeSingle()
      if (exists) continue
    }

    const fromEmail = env.from?.[0]?.address ?? ''
    const fromName  = env.from?.[0]?.name ?? ''

    const { data: contact } = fromEmail
      ? await supabase.from('contacts').select('id')
          .eq('email', fromEmail).eq('tenant_id', TENANT_ID).maybeSingle()
      : { data: null }

    const { error: insertErr } = await supabase.from('emails').insert({
      tenant_id: TENANT_ID,
      account_id: acc.id,
      message_id: msgId,
      thread_id: env.inReplyTo ?? msgId ?? null,
      in_reply_to: env.inReplyTo ?? null,
      direction: 'inbound',
      from_email: fromEmail,
      from_name: fromName,
      to_emails: (env.to ?? []).map((a: { address?: string; name?: string }) => ({ email: a.address, name: a.name })),
      cc_emails: (env.cc ?? []).map((a: { address?: string; name?: string }) => ({ email: a.address, name: a.name })),
      subject: env.subject ?? '(без темы)',
      body_html: null,
      body_text: null,
      imap_uid: uid,
      imap_folder: 'INBOX',
      contact_id: contact?.id ?? null,
      received_at: env.date?.toISOString() ?? new Date().toISOString(),
      is_read: false,
    })

    if (insertErr) {
      if (insertErr.code !== '23505') {
        console.error('[imap insert]', acc.email, insertErr.message)
        throw new Error(insertErr.message)
      }
    } else {
      synced++
    }
  }

  return synced
}

// GET — sync all accounts (for Vercel cron)
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const { data: accounts } = await supabase.from('email_accounts')
    .select('*').eq('tenant_id', TENANT_ID).eq('status', 'active').not('imap_host', 'is', null)

  if (!accounts?.length) return NextResponse.json({ ok: true, synced: 0 })

  let total = 0
  for (const acc of accounts) {
    try { total += await syncAccount(acc, supabase) } catch {}
  }
  return NextResponse.json({ ok: true, synced: total })
}

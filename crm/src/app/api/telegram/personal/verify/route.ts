import { NextRequest, NextResponse } from 'next/server'
import { TelegramClient, Api, password as tgPassword } from 'telegram'
import { StringSession } from 'telegram/sessions'
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

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin'])
  if (!auth.ok) return auth.error

  const { code, password } = await req.json().catch(() => ({}))
  if (!code) return NextResponse.json({ error: 'Нужен код' }, { status: 400 })

  const supabase = getSupabase()

  const { data: rows } = await supabase.from('tenant_settings')
    .select('key, value').eq('tenant_id', TENANT_ID)
    .in('key', ['TG_PERSONAL_SESSION', 'TG_PERSONAL_PHONE', 'TG_PERSONAL_PHONE_HASH',
                'TELEGRAM_API_ID', 'TELEGRAM_API_HASH'])

  const s: Record<string, string> = {}
  for (const r of rows ?? []) s[r.key] = r.value

  const apiId = Number(s.TELEGRAM_API_ID || process.env.TELEGRAM_API_ID || '0')
  const apiHash = s.TELEGRAM_API_HASH || process.env.TELEGRAM_API_HASH || ''
  const sessionStr = s.TG_PERSONAL_SESSION || ''
  const phone = s.TG_PERSONAL_PHONE
  const phoneCodeHash = s.TG_PERSONAL_PHONE_HASH

  if (!phone || !phoneCodeHash) {
    return NextResponse.json({ error: 'Сначала запросите код (шаг 1)' }, { status: 400 })
  }

  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  })

  try {
    await client.connect()

    try {
      await client.invoke(new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      }))
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        if (!password) {
          const midSession = (client.session.save() as unknown) as string
          await supabase.from('tenant_settings').upsert(
            [{ tenant_id: TENANT_ID, key: 'TG_PERSONAL_SESSION', value: midSession }],
            { onConflict: 'tenant_id,key' }
          )
          await client.disconnect()
          return NextResponse.json({ needs2fa: true })
        }
        // Complete 2FA
        const pwdInfo = await client.invoke(new Api.account.GetPassword())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pwdCheck = await tgPassword.computeCheck(pwdInfo as any, password)
        await client.invoke(new Api.auth.CheckPassword({ password: pwdCheck }))
      } else {
        throw e
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const me = (await client.getMe()) as any
    const finalSession = (client.session.save() as unknown) as string
    await client.disconnect()

    await supabase.from('tenant_settings').upsert([
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_SESSION',  value: finalSession },
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_USERNAME', value: me?.username ?? me?.firstName ?? '' },
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_STATUS',   value: 'connected' },
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_PHONE_HASH', value: '' },
    ], { onConflict: 'tenant_id,key' })

    return NextResponse.json({ ok: true, username: me?.username, name: me?.firstName })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e)
    console.error('[tg personal verify]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { TelegramClient } from 'telegram'
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

async function getApiCreds(supabase: ReturnType<typeof getSupabase>) {
  const { data } = await supabase.from('tenant_settings')
    .select('key, value').eq('tenant_id', TENANT_ID)
    .in('key', ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH'])
  const s: Record<string, string> = {}
  for (const r of data ?? []) s[r.key] = r.value
  return {
    apiId: Number(s.TELEGRAM_API_ID || process.env.TELEGRAM_API_ID || '0'),
    apiHash: s.TELEGRAM_API_HASH || process.env.TELEGRAM_API_HASH || '',
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['owner', 'admin'])
  if (!auth.ok) return auth.error

  const { phone } = await req.json().catch(() => ({}))
  if (!phone) return NextResponse.json({ error: 'Нужен номер телефона' }, { status: 400 })

  const supabase = getSupabase()
  const { apiId, apiHash } = await getApiCreds(supabase)

  if (!apiId || !apiHash) {
    return NextResponse.json({ error: 'Настройте API_ID и API_HASH в настройках (my.telegram.org)' }, { status: 400 })
  }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  })

  try {
    await client.connect()
    const result = await client.sendCode({ apiId, apiHash }, phone)
    const sessionStr = (client.session.save() as unknown) as string
    await client.disconnect()

    // Persist session + auth state
    await supabase.from('tenant_settings').upsert([
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_SESSION',    value: sessionStr },
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_PHONE',      value: phone },
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_PHONE_HASH', value: result.phoneCodeHash },
      { tenant_id: TENANT_ID, key: 'TG_PERSONAL_STATUS',     value: 'pending' },
    ], { onConflict: 'tenant_id,key' })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e)
    console.error('[tg personal start]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data: rows } = await supabase.from('tenant_settings')
    .select('key, value').eq('tenant_id', TENANT_ID)
    .in('key', ['TG_PERSONAL_STATUS', 'TG_PERSONAL_USERNAME', 'TG_PERSONAL_PHONE',
                'TELEGRAM_API_ID', 'TELEGRAM_API_HASH'])

  const s: Record<string, string> = {}
  for (const r of rows ?? []) s[r.key] = r.value

  return NextResponse.json({
    status: s.TG_PERSONAL_STATUS ?? 'disconnected',
    username: s.TG_PERSONAL_USERNAME ?? null,
    phone: s.TG_PERSONAL_PHONE ?? null,
    hasApiCreds: Boolean(s.TELEGRAM_API_ID && s.TELEGRAM_API_HASH),
  })
}

export async function DELETE() {
  const supabase = getSupabase()
  await supabase.from('tenant_settings').delete()
    .eq('tenant_id', TENANT_ID)
    .in('key', ['TG_PERSONAL_SESSION', 'TG_PERSONAL_STATUS', 'TG_PERSONAL_USERNAME',
                'TG_PERSONAL_PHONE', 'TG_PERSONAL_PHONE_HASH'])
  return NextResponse.json({ ok: true })
}

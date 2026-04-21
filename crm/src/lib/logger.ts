/**
 * System event logger → Supabase system_logs table
 * Used by all API routes to track what's happening
 */
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function logEvent(
  event: string,
  detail: Record<string, unknown> = {},
  status: 'ok' | 'failed' = 'ok',
  error_msg?: string
) {
  try {
    await getSupabase().from('system_logs').insert({
      tenant_id: TENANT_ID,
      event,
      status,
      detail,
      error_msg: error_msg ?? null,
      level: status === 'failed' ? 'error' : 'info',
    })
  } catch {
    // never block main flow
  }
}

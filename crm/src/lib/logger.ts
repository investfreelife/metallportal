/**
 * System event logger → Supabase system_logs table
 * Used by all API routes to track what's happening.
 *
 * Multi-tenant 2026-06-03: `tenantId` параметр optional. Если не передан —
 * фоллбэк к session-resolved tenant (getTenantId()), который сам падает на
 * DEFAULT_TENANT_ID. Авторские роуты должны явно передавать `TENANT_ID`
 * (declared as `getTenantIdFromRequest(request)` at handler entry).
 */
import { createClient } from '@supabase/supabase-js'
import { getTenantId } from './session'

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
  error_msg?: string,
  tenantId?: string
) {
  try {
    const tenant = tenantId ?? await getTenantId()
    await getSupabase().from('system_logs').insert({
      tenant_id: tenant,
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

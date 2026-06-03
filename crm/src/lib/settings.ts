import { createClient } from '@supabase/supabase-js'
import { getTenantId } from './session'

/**
 * Multi-tenant 2026-06-03: каждая функция принимает optional `tenantId`.
 * Если не передан — резолвится из текущей session (Server Components,
 * Route Handlers). Cache теперь keyed by `${tenant}::${key}` чтобы не
 * cross-pollinate между фирмами.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const cache = new Map<string, string>()

/**
 * Read a setting: first process.env, then Supabase tenant_settings.
 */
export async function getSetting(key: string, tenantId?: string): Promise<string | undefined> {
  if (process.env[key]) return process.env[key]
  const tenant = tenantId ?? await getTenantId()
  const cacheKey = `${tenant}::${key}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenant)
      .eq('key', key)
      .single()
    if (data?.value) {
      cache.set(cacheKey, data.value)
      return data.value
    }
  } catch {}
  return undefined
}

/**
 * Write a setting to Supabase (upsert).
 */
export async function setSetting(key: string, value: string, tenantId?: string): Promise<void> {
  const tenant = tenantId ?? await getTenantId()
  const supabase = getSupabase()
  await supabase.from('tenant_settings').upsert(
    { tenant_id: tenant, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,key' }
  )
  cache.set(`${tenant}::${key}`, value)
}

/**
 * Get all settings for this tenant (from DB only).
 */
export async function getAllSettings(tenantId?: string): Promise<Record<string, string>> {
  const tenant = tenantId ?? await getTenantId()
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tenant_settings')
    .select('key, value')
    .eq('tenant_id', tenant)

  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.value) result[row.key] = row.value
  }
  return result
}

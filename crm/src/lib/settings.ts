import { createClient } from '@supabase/supabase-js'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const cache = new Map<string, string>()

/**
 * Read a setting: first process.env, then Supabase tenant_settings
 */
export async function getSetting(key: string): Promise<string | undefined> {
  if (process.env[key]) return process.env[key]
  if (cache.has(key)) return cache.get(key)

  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', TENANT_ID)
      .eq('key', key)
      .single()
    if (data?.value) {
      cache.set(key, data.value)
      return data.value
    }
  } catch {}
  return undefined
}

/**
 * Write a setting to Supabase (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('tenant_settings').upsert(
    { tenant_id: TENANT_ID, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id,key' }
  )
  cache.set(key, value)
}

/**
 * Get all settings for this tenant (from DB only)
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tenant_settings')
    .select('key, value')
    .eq('tenant_id', TENANT_ID)

  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.value) result[row.key] = row.value
  }
  return result
}

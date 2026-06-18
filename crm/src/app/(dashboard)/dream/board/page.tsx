import { createClient } from '@supabase/supabase-js'
import { SalesBoard } from './SalesBoard'

export const dynamic = 'force-dynamic'

const DREAM_TENANT_ID = '11111111-2222-3333-4444-555555555555'

export default async function BoardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Берём лидов которые УЖЕ в продаже (build_status='built' или дальше + любой sales_stage)
  // Плюс те у которых уже зашли в воронку продаж.
  const { data: leads } = await supabase
    .from('dream_leads')
    .select('id, slug, name, niche, phone, rating, sales_stage, qualification, decision_maker_name, decision_maker_phone, preferred_channel, callback_at, last_contact_at, last_channel, unread_count, next_action_at, next_action_goal, next_action_by, call_attempts, visits_count, max_scroll_pct, total_time_on_site_sec, landing_public_url, updated_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .in('build_status', ['built','review_built','for_sale','selling','sold','lost'])
    .order('updated_at', { ascending: false })

  return <SalesBoard leads={leads ?? []} />
}

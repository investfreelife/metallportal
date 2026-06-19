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

  // TASK_022/024: ДОСКА «Продажа» = только сайты которые УТВЕРЖДЕНЫ ДЛЯ ПРОДАЖИ
  //   build_status IN ('for_sale','selling','sold','lost')  — основные стадии продаж
  //   build_status='built'/'review_built' — это «Проверка сайта», на доску ещё НЕ ПОПАДАЮТ
  // Закрытые продажи (sales_stage won/lost/disqualified) идут в свои колонки на этой же доске.
  // НЕ должно быть лидов в стадии building/approved/parsed — они в /dream/kanban.
  const { data: leads } = await supabase
    .from('dream_leads')
    .select('id, slug, name, niche, phone, rating, build_status, sales_stage, qualification, decision_maker_name, decision_maker_phone, preferred_channel, callback_at, last_contact_at, last_channel, unread_count, next_action_at, next_action_goal, next_action_by, call_attempts, visits_count, max_scroll_pct, total_time_on_site_sec, landing_public_url, updated_at')
    .eq('tenant_id', DREAM_TENANT_ID)
    .in('build_status', ['for_sale', 'selling', 'sold', 'lost'])
    .order('updated_at', { ascending: false })

  return <SalesBoard leads={leads ?? []} />
}

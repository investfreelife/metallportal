import { createClient } from '@/lib/supabase/server'
import DealsKanban from './DealsKanban'

export default async function DealsPage() {
  const supabase = await createClient()

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id, title, amount, currency, stage, ai_win_probability,
      ai_recommendation, expected_close_date, assigned_to, created_at,
      contact:contacts(id, full_name, company_name)
    `)
    .order('created_at', { ascending: false })

  return <DealsKanban deals={deals ?? []} />
}

import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import MarketingPlanClient from './MarketingPlanClient';
import type { MarketingTheme } from '@/lib/marketing-plan/types';

export const dynamic = 'force-dynamic';

/**
 * /marketing-plan — стратегия маркетинга (campaigns).
 * Кампании сгруппированы по segment, отсортированы по seg_order. Из любой
 * можно «Раскрыть в пост» — это создаёт черновик в ad_variants.
 *
 * Task 050 (sergey-coder, taksopark-machine): копия /content-plan для
 * маркетинга, источник — campaigns + ad_variants.
 */
export default async function MarketingPlanPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data: themes } = await supabase
    .from('campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('seg_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  return (
    <MarketingPlanClient
      initialThemes={(themes ?? []) as MarketingTheme[]}
      tenantName={session.tenant_name ?? null}
    />
  );
}

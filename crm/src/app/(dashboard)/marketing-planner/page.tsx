import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import MarketingPlannerClient from './MarketingPlannerClient';
import type { MarketingPost } from '@/lib/marketing-plan/types';

/**
 * /marketing-planner — главный экран маркетинг-планировщика.
 * Task 050 (sergey-coder, taksopark-machine): копия /content для маркетинга,
 * данные — ad_variants. Календарь + согласование + публикация в TG/VK.
 */
export const dynamic = 'force-dynamic';

export default async function MarketingPlannerPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from('ad_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data: conns } = await supabase
    .from('connections')
    .select('id, platform, label, enabled')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  return (
    <MarketingPlannerClient
      initialPosts={(posts ?? []) as MarketingPost[]}
      activeConnections={conns ?? []}
      tenantName={session.tenant_name ?? null}
    />
  );
}

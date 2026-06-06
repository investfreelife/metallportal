import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import MarketingPlannerClient from './MarketingPlannerClient';
import type { MarketingPost } from '@/lib/marketing-plan/types';

/**
 * /marketing-planner — посев-планировщик: КАЛЕНДАРЬ + согласование +
 * публикация в TG/VK. Источник — ad_variants.
 *
 * Task 050 (taksopark-machine, sergey-coder): копия системы Контента
 * для маркетинга. Task 063: восстановлен из 062-редиректа — это НЕ
 * дубль маркетинга, а отдельный календарь посев-постов.
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
    .neq('status', 'archived')              // не показываем архив (история A/B) — только активные посты
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

import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import VkGroupsClient from './VkGroupsClient';

export const dynamic = 'force-dynamic';

/**
 * /vk-groups — ТЗ-070 часть B: каталог VK-сообществ (донорская разведка).
 * Источник: channels где config.kind='vk_group' (пишет automation/parser/vk_groups_parser.py).
 * VK API не постит на чужие стены → это разведка аудитории + разметка post_mode
 * (open / предложка / комменты / ads / закрыто). Только taxi-tenant.
 */
export default async function VkGroupsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry !== 'taxi') redirect('/dashboard');

  const tenantId = await getTenantId();
  const supabase = await createClient();
  const { data } = await supabase
    .from('channels')
    .select('id, name, config')
    .eq('tenant_id', tenantId)
    .filter('config->>kind', 'eq', 'vk_group')
    .order('created_at', { ascending: false })
    .limit(8000);

  return <VkGroupsClient initialGroups={(data ?? []) as VkRow[]} />;
}

export interface VkRow {
  id: string;
  name: string | null;
  config: Record<string, unknown> | null;
}

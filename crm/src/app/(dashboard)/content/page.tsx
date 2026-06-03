import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import ContentClient from './ContentClient';
import type { ContentPost } from '@/lib/content/types';

/**
 * /content — главный экран планировщика.
 * Sergey directive 2026-06-03 — calendar + согласование + публикация,
 * замена облачного Postiz, данные у нас.
 */
export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from('content_posts')
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
    <ContentClient
      initialPosts={(posts ?? []) as ContentPost[]}
      activeConnections={conns ?? []}
      tenantName={session.tenant_name ?? null}
    />
  );
}

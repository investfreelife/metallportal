import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import ContentPlanClient from './ContentPlanClient';
import type { ContentTheme } from '@/lib/content/themes';

export const dynamic = 'force-dynamic';

/**
 * /content-plan — стратегия контента (content_themes).
 * Темы сгруппированы по rubric, отсортированы по priority. Из любой можно
 * «Раскрыть в пост» — это создаёт черновик в content_posts.
 */
export default async function ContentPlanPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data: themes } = await supabase
    .from('content_themes')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('rubric', { ascending: true })
    .order('priority', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });

  return (
    <ContentPlanClient
      initialThemes={(themes ?? []) as ContentTheme[]}
      tenantName={session.tenant_name ?? null}
    />
  );
}

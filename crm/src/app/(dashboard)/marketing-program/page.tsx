import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import MarketingProgramClient from './MarketingProgramClient';

export const dynamic = 'force-dynamic';

/**
 * /marketing-program — отражает Маркетинг-программу v2 проекта Таксопарк-
 * Машина (Столица). Все данные уже лежат в Supabase (channels type='tracking')
 * — это клиент-страница, грузит через /api/recruit/marketing/program.
 *
 * Task 051 (sergey-coder, taksopark-machine).
 */
export default async function MarketingProgramPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <MarketingProgramClient tenantName={session.tenant_name ?? null} />;
}

import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import MarketingListClient from './MarketingListClient';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <MarketingListClient tenantName={session.tenant_name ?? null} />;
}

import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import KbClient from './KbClient';

export const dynamic = 'force-dynamic';

export default async function KbPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <KbClient tenantName={session.tenant_name ?? null} />;
}

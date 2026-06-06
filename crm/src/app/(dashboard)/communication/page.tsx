import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CommunicationClient from './CommunicationClient';

export const dynamic = 'force-dynamic';

export default async function CommunicationPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry && session.industry !== 'taxi') redirect('/dashboard');
  return <CommunicationClient tenantName={session.tenant_name ?? null} />;
}

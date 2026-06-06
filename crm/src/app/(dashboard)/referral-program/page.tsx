import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ReferralProgramClient from './ReferralProgramClient';

export const dynamic = 'force-dynamic';

export default async function ReferralProgramPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry && session.industry !== 'taxi') redirect('/dashboard');
  return <ReferralProgramClient tenantName={session.tenant_name ?? null} />;
}

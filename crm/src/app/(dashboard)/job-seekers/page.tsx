import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import JobSeekersClient from './JobSeekersClient';

export const dynamic = 'force-dynamic';

/**
 * /job-seekers — Task 065. Вкладка «🔥 Соискатели» (taxi).
 */
export default async function JobSeekersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry && session.industry !== 'taxi') redirect('/dashboard');
  return <JobSeekersClient tenantName={session.tenant_name ?? null} />;
}

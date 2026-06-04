import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DriversClient from './DriversClient';

export const dynamic = 'force-dynamic';

/**
 * /drivers — действующие водители (contacts type='driver', status='active').
 * Sergey directive 2026-06-04: сюда попадают после перевода из воронки
 * через кнопку «✅ В водители» в /funnel.
 *
 * До этого был ComingSoon — теперь живой список.
 */
export default async function DriversPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <DriversClient tenantName={session.tenant_name ?? null} />;
}

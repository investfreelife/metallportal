import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CarPartnersClient from './CarPartnersClient';

export const dynamic = 'force-dynamic';

export default async function CarPartnersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <CarPartnersClient tenantName={session.tenant_name ?? null} />;
}

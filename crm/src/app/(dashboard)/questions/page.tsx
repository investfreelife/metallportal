import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import QuestionsClient from './QuestionsClient';

export const dynamic = 'force-dynamic';

export default async function QuestionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <QuestionsClient tenantName={session.tenant_name ?? null} />;
}

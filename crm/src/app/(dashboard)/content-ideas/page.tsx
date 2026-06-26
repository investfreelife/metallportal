import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ContentIdeasClient from './ContentIdeasClient';

export const dynamic = 'force-dynamic';

/**
 * /content-ideas — инфо-поводы из групп-источников (идеи для нашего канала).
 * Парсер пишет их строками channels (type='tracking', config.kind='content_idea').
 */
export default async function ContentIdeasPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <ContentIdeasClient tenantName={session.tenant_name ?? null} />;
}

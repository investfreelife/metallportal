import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CampaignDetailClient from './CampaignDetailClient';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;
  return <CampaignDetailClient campaignId={id} tenantName={session.tenant_name ?? null} />;
}

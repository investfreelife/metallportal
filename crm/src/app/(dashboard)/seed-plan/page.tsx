import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SeedPlanClient from './SeedPlanClient';

export const dynamic = 'force-dynamic';

/**
 * /seed-plan — план «посева» рекрутинговых постов (Telegram / VK).
 * Когда и куда машина публикует, сгруппировано по дням (МСК).
 */
export default async function SeedPlanPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <SeedPlanClient />;
}

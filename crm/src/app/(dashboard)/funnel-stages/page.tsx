import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import FunnelStagesClient from './FunnelStagesClient';

export const dynamic = 'force-dynamic';

/**
 * /funnel-stages — Воронка по полной модели стадий (Task 056).
 * Канбан по стадиям (new…retained + sleeping/lost/spam) + красная панель
 * (SLA-утечки, пустые next_touch_at, протухшие обещания).
 *
 * Старая /funnel остаётся как «по chat_id из dialog_messages».
 */
export default async function FunnelStagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <FunnelStagesClient tenantName={session.tenant_name ?? null} />;
}

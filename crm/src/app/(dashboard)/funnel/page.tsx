import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import FunnelClient from './FunnelClient';

export const dynamic = 'force-dynamic';

/**
 * /funnel — канбан-доска кандидатов.
 * Источник: dialog_messages, агрегация в /api/recruit/funnel.
 * Загружается клиентом, чтобы автообновление и кнопки работали без SSR-перезагрузки.
 */
export default async function FunnelPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <FunnelClient tenantName={session.tenant_name ?? null} />;
}

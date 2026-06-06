import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SeedGroupsClient from './SeedGroupsClient';

export const dynamic = 'force-dynamic';

/**
 * /seed-groups — ТЗ-064: «Готовы к засеву».
 *
 * Сергей руками отмечает группы готовые к засеву, ставит механику постинга,
 * прикрепляет одобренный текст, добавляет новые группы списком @username.
 * Мозг потом проходит по seed_ready=true и запускает засев.
 *
 * Только для taxi-tenant'а (как /channels).
 */
export default async function SeedGroupsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry !== 'taxi') redirect('/dashboard');
  return <SeedGroupsClient />;
}

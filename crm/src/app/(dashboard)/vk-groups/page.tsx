import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import VkGroupsClient from './VkGroupsClient';

export const dynamic = 'force-dynamic';

/**
 * /vk-groups — ТЗ-070 часть B: каталог VK-сообществ (донорская разведка).
 * Sergey directive 2026-06-06: «сделай как в Telegram — можно добавлять,
 * редактировать, описание, фильтр можно-писать/платно».
 *
 * Источник: channels где config.kind='vk_group'. Только taxi-tenant.
 */
export default async function VkGroupsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry !== 'taxi') redirect('/dashboard');
  return <VkGroupsClient />;
}

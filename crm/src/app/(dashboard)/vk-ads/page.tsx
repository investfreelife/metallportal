import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import VkAdsClient from './VkAdsClient';

export const dynamic = 'force-dynamic';

/**
 * /vk-ads — ТЗ-079: вкладка «📢 ВК Реклама».
 * Редактор VK-объявлений: текст-блоки с лимитами, слоты картинок по точным
 * размерам, ТЗ дизайнеру, статус-воркфлоу, бюджет, кнопки залива (через мозг).
 * taxi-only.
 */
export default async function VkAdsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry !== 'taxi') redirect('/dashboard');
  return <VkAdsClient />;
}

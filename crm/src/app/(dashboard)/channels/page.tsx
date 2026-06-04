import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ChannelsClient } from './ChannelsClient';
import TelegramGroupsClient from './TelegramGroupsClient';

export const dynamic = 'force-dynamic';

/**
 * /channels — industry-aware dispatch:
 *   - 'taxi'  → таблица спарсенных Telegram-групп + панель управления парсером
 *   - иначе   → менеджер маркетинговых каналов (Я.Директ, VK Ads, …) — как было
 *
 * Sergey directive 2026-06-03: «нужна ТАБЛИЦА списком + панель парсера, а не
 * карточки с настройками». Для taxi tenant'а страница перепрофилирована
 * под рекрутинг через групп-доноров. Металловый use-case не тронут.
 */
export default async function ChannelsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (session.industry === 'taxi') {
    return <TelegramGroupsClient tenantName={session.tenant_name ?? null} />;
  }

  // Старый flow — для металлового tenant'а.
  const TENANT_ID = await getTenantId();
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('status');

  return <ChannelsClient initialChannels={channels || []} />;
}

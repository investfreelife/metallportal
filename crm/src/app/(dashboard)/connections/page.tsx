import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import ConnectionsClient from './ConnectionsClient';
import { maskToken } from '@/lib/content/types';

export const dynamic = 'force-dynamic';

/**
 * /connections — CRUD для связей с Telegram/VK.
 * Sergey directive 2026-06-03 — toggle вкл/выкл, проверка через движок publisher.
 */
export default async function ConnectionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data } = await supabase
    .from('connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  // Токены маскируем перед отправкой в client
  const masked = (data ?? []).map((c) => ({ ...c, token: maskToken(c.token), token_set: !!c.token }));

  return <ConnectionsClient initial={masked} tenantName={session.tenant_name ?? null} />;
}

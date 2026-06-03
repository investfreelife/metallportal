import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { redirect } from 'next/navigation';
import FunnelClient from './FunnelClient';

export const dynamic = 'force-dynamic';

/**
 * /funnel — канбан-доска по этапам кандидатов (contacts.status).
 * Карточки сразу видны на сервере (SSR), без полла — но клиентский
 * компонент тоже умеет перезагружать через REST.
 */
export default async function FunnelPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data } = await supabase
    .from('contacts')
    .select(
      'id, full_name, type, status, source, telegram, telegram_chat_id, last_contact_at, ai_segment, ai_score, tags, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .order('status', { ascending: true })
    .order('last_contact_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1000);

  return (
    <FunnelClient
      initialContacts={data ?? []}
      tenantName={session.tenant_name ?? null}
    />
  );
}

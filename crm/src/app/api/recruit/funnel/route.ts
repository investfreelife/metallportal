import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/funnel
 *
 * Контакты-кандидаты tenant'а — для канбан-доски «Воронка».
 * Возвращает массив contacts с полями для карточки + dialog chat_id
 * если есть (telegram_chat_id). Tenant-scoped.
 *
 * Sort: status ASC, last_contact_at DESC.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select(
      'id, full_name, type, status, source, telegram, telegram_chat_id, last_contact_at, ai_segment, ai_score, tags, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .order('status', { ascending: true })
    .order('last_contact_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

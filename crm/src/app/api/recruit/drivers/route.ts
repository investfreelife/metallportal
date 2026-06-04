import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/drivers
 *
 * Действующие водители = contacts WHERE type='driver' AND status='active'.
 * Список для страницы «Водители» (после перевода из воронки через
 * /api/recruit/funnel/promote).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, phone, telegram, telegram_chat_id, source, tags, last_contact_at, created_at, notes, metadata')
      .eq('tenant_id', tenantId)
      .eq('type', 'driver')
      .eq('status', 'active')
      .order('last_contact_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ drivers: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

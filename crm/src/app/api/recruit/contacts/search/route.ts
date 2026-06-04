import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/contacts/search?q=...
 *
 * Подсказка для модала «+ Добавить кандидата» → опция «Выбрать
 * существующий контакт». Ищем в contacts tenant'а по имени / телефону /
 * telegram / email (ilike, escape %_).
 *
 * Лимит 25.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const search = req.nextUrl.searchParams.get('q')?.trim();

    const supabase = await createClient();
    let q = supabase
      .from('contacts')
      .select('id, full_name, phone, telegram, telegram_chat_id, type, status, source, ai_segment')
      .eq('tenant_id', tenantId)
      .order('last_contact_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(25);

    if (search) {
      const safe = search.replace(/[%_]/g, (m) => `\\${m}`);
      q = q.or(
        `full_name.ilike.%${safe}%,phone.ilike.%${safe}%,telegram.ilike.%${safe}%,email.ilike.%${safe}%`
      );
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contacts: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

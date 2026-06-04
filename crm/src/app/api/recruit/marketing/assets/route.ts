import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

/**
 * GET /api/recruit/marketing/assets
 *
 * Готовые медиа-активы tenant'а (marketing_assets): лендинги, видео-нарезки,
 * ссылки на статичные креативы. Используется на вкладке Маркетинг → Наш
 * маркетинг → Лендинги (и в перспективе другие каналы).
 *
 * Query:
 *   ?channel=landing|vk|telegram|yandex|...  — фильтр канала (опц.)
 *
 * Возвращает: {items: AssetRow[]}
 */
export const dynamic = 'force-dynamic';

interface AssetRow {
  id: string;
  channel: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  status: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const channel = req.nextUrl.searchParams.get('channel');

    const supabase = await createClient();
    let q = supabase
      .from('marketing_assets')
      .select('id, channel, title, body, link, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (channel) q = q.eq('channel', channel);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: (data ?? []) as AssetRow[] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

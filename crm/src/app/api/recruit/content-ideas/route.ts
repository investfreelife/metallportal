import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recruit/content-ideas
 *
 * Инфо-поводы — идеи для нашего канала, которые парсер выудил из групп-источников.
 * Хранятся как строки channels с type='tracking' и config.kind='content_idea'.
 * config.source — username группы-источника, config.text — текст сообщения-повода.
 */
interface ChannelRow {
  id: string;
  config: Record<string, unknown> | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('channels')
      .select('id, config')
      .eq('tenant_id', tenantId)
      .eq('type', 'tracking')
      .order('id', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = ((data ?? []) as ChannelRow[])
      .filter((r) => str((r.config ?? {}).kind) === 'content_idea')
      .map((r) => {
        const cfg = (r.config ?? {}) as Record<string, unknown>;
        const source = str(cfg.source);
        return {
          id: r.id,
          source,
          text: str(cfg.text),
          link: source ? `https://t.me/${source.replace(/^@/, '')}` : null,
        };
      });

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/recruit/parser-channels/[id]
 * Удалить ряд channel'а (только telegram_channel type, не systemic parser_*).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = await getTenantId();
    const { id } = await ctx.params;

    const supabase = await createClient();
    // Сначала проверим что это не системная строка парсера (anti-fat-finger).
    const { data: row } = await supabase
      .from('channels')
      .select('id, type, config')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const kind = (row.config as { kind?: string } | null)?.kind;
    if (kind === 'parser_status' || kind === 'parser_control') {
      return NextResponse.json({ error: `Системная строка ${kind} — удалять нельзя` }, { status: 403 });
    }
    if (row.type !== 'telegram_channel') {
      return NextResponse.json({ error: 'Только telegram_channel можно удалять отсюда' }, { status: 403 });
    }

    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

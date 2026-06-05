import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/recruit/seed-plan/[id]
 * Удалить строку плана посева (только config.kind='seed_plan').
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
    // Проверим что это именно строка плана посева (anti-fat-finger).
    const { data: row } = await supabase
      .from('channels')
      .select('id, config')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    const kind = (row.config as { kind?: string } | null)?.kind;
    if (kind !== 'seed_plan') {
      return NextResponse.json({ error: 'Можно удалять только строки плана посева' }, { status: 403 });
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

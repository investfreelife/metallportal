import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession, getTenantId } from '@/lib/session';
import { checkConnection } from '@/lib/publisher';

/**
 * POST /api/content/connections/[id]/check
 * Дёргает движок publisher.checkConnection → возвращает { ok, info?, error? }.
 * Также пишет результат в connections.meta (last_checked_at, info/error).
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantId();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: conn } = await supabase
    .from('connections')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!conn) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });

  const result = await checkConnection({
    platform: conn.platform,
    token: conn.token,
    target_id: conn.target_id,
  });

  await supabase
    .from('connections')
    .update({
      meta: {
        ...(conn.meta || {}),
        last_checked_at: new Date().toISOString(),
        check_info: result.ok ? result.info : undefined,
        last_error: result.ok ? undefined : result.error,
      },
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return NextResponse.json(result);
}
